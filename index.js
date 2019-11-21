var express = require('express');
var favicon = require('serve-favicon');
var path = require('path');
const crypto = require('crypto');
const algorithm = 'aes-256-cbc';
var passwordHash = require('password-hash');
const key = crypto.randomBytes(32);
const iv = crypto.randomBytes(16);
var mysql = require('mysql');
const cron = require('node-cron')
var bodyparser = require('body-parser');
var morgan = require('morgan');
var cors = require("cors");
var app = express();
app.use(cors());
app.use('*', cors());
app.use(morgan('dev'));
var PORT = process.env.PORT || 3000;
var connection;
app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')))

var dateNow = new Date();
var dd = dateNow.getDate();
var monthSingleDigit = dateNow.getMonth() + 1,
    mm = monthSingleDigit < 10 ? '0' + monthSingleDigit : monthSingleDigit;
var yy = dateNow.getFullYear().toString().substr(2);

var formattedDate = yy + '-' + mm + '-' + dd;

calc_BMR(85, 183, 'female', 26, 1.2);
//connect to database
var db = mysql.createConnection({
    host: 'eu-cdbr-west-02.cleardb.net',
    user:  'b38fc8f95008e4',
    password: '7c82abfb',
    database: 'heroku_c3049d83766a9a7'
});

app.use(bodyparser.urlencoded({
    extended: true
}));

//connect to database
db.connect((err) => {
    if (err) {
        throw err;
    }
    console.log('mysql connected...')
});
app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')))

//register a new user
app.post('/register', function (req, res) {

    var pad = function (num) { return ('00' + num).slice(-2) };
    date = new Date();
    var parts = req.body.birthday.split('/');
    var mydate = new Date(parts[2],parts[1] - 1, parts[0]);
    new Date()
    username = req.body.username;
    gender = req.body.gender;
    email = req.body.email;
    var password = encrypt(req.body.password);
    birthday = mydate.getUTCFullYear() + '-' + pad(mydate.getUTCMonth() + 1) + '-' + pad(mydate.getUTCDate());
    height = req.body.height;
    weight = req.body.weight;
    frequence_activity = req.body.frequence_activity;
    age = date.getFullYear() - mydate.getFullYear();
    BMI = calc_BMI(weight,height);
    BMR = calc_BMR(weight,height,gender,age,frequence_activity);

    let user = { username: username, gender: gender, email: email, password: password, birthday: birthday, height: height, weight: weight, frequence_activity: frequence_activity, BMI: BMI.bmi, BMR: BMR};
    let sql = 'INSERT INTO user SET ?'

    let researchSql = `SELECT COUNT(*) AS idCount FROM user WHERE username = "${username}"`;
    db.query(researchSql, (error, results) => {
        if (error) throw error;
        if (results[0].idCount == 0) {
            db.query(sql, user, (err, result) => {
                if (err) throw err;
                let selctSql = `SELECT * FROM user WHERE id = "${result.insertId}"`;
                db.query(selctSql, (error, results) => {
                    if (results[0]) {
                        let row = {user_id:results[0].id, date:formattedDate};
                        let sqlin = `INSERT INTO dailycal set ?`
                        let query = db.query(sqlin, row, (err,result) => {
                            if(err) throw err;
                            console.log(result);
                          })
                        res.status(200).send(results[0]);
                    } else {
                        res.status(400).send("Oops :( ");
                    }

                })
                console.log(result);
            })
        } else {
            res.status(400).send('username already exist')
        }
    });


});

//Calculate BMR
app.get('/calculate_bmr', function (req, res) { 
    var weight = req.body.weight;
    var height = req.body.height;
    var age = req.body.age;
    var gender = req.body.gender;
    var frequence_activity = req.body.frequence_activity;
    
    res.status(200).send({'bmr': calc_BMR(weight, height, gender,age, frequence_activity)});

});
//Calculate BMI
app.get('/calculate_bmi', function (req, res) { 
    var weight = req.body.weight;
    var height = req.body.height;
    
    res.status(200).send(calc_BMI(weight, height));

});

//login
app.post('/login', function (req, res) {
    username = req.body.username;
    password = req.body.password;

    let researchSql = `SELECT COUNT(*) as idCount FROM user WHERE username = "${username}"`;
    db.query(researchSql, (error, results) => {
        if (error) throw error;
        if (results[0].idCount == 0) {
            res.status(400).send('wrong username');
        } else {
            let selctSql = `SELECT * FROM user WHERE username = "${username}"`;
            db.query(selctSql, (error, results) => {
                if (decrypt(password, results[0].password)) {
                    var user = results[0];
                    res.status(200).send(results[0]);
                } else {
                    res.status(400).send("wrong password");
                }
            })
        }
    });
});

app.get('/', function (req, res) {
    res.send({ 'message': 'Hello there !' });
});

app.listen(PORT, function () {
    console.log('app listening on port ' + PORT);
});
//encrypt and decrypt function for password
function encrypt(text) {
    let cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return { iv: iv.toString('hex'), encryptedData: encrypted.toString('hex') };
}
//get cateroies
app.get('/categories',(req,res) => {
    let sql = `SELECT * FROM food_category`;
    let query = db.query(sql, (err,results) => {
        if(err) throw err;
        console.log(results);
        res.status(200).send({'categories': results});
    })
});
//get foodbycategories
app.post('/foodbycategory',(req,res) => {
    var category = req.body.category
    let sqlid = `SELECT id as id FROM food_category WHERE category_name = '${category}'`
    console.log(sqlid)
    let query = db.query(sqlid, (err,results) => {
        if(err) throw err;
        console.log(results[0].id);
        id = results[0].id
        let sql = `SELECT * FROM food_calorie WHERE category = ${id}`;
        let query = db.query(sql, (err,results) => {
            if(err) throw err;
            console.log(results);
            res.status(200).send(results);
        })
    })
    
});
//dailytracking
app.post('/dailytrack', function (req, res) {
    id = req.body.userid;
    cal = req.body.calories;

    let researchSql = `SELECT COUNT(*) as idCount FROM dailycal WHERE user_id = "${id}" AND date = '${formattedDate}'`;
    db.query(researchSql, (error, results) => {
        if (error) throw error;
        if (results[0].idCount == 0) {
            let row = {user_id:id, calories:cal, date:formattedDate};
            let sql = 'INSERT INTO dailycal SET ?'
            let query = db.query(sql, row, (err,result) => {
              if(err) throw err;
                console.log(result);
                res.status(200).send({'message' : 'row added'});
            })
        } else {
            let sql = `SELECT calories as cal FROM dailycal WHERE user_id = "${id}" AND date = '${formattedDate}'`;
            let query = db.query(sql, (error,results) => {
                if (error) throw error;
                console.log('calorie from result: ', results[0].cal)
                calorie = results[0].cal + parseFloat(cal);
                console.log(calorie)
                let sqlUpdate = `UPDATE dailycal SET calories = ${calorie} WHERE user_id = ${id} AND date = '${formattedDate}'`
                console.log(sqlUpdate)
                let query = db.query(sqlUpdate, (err,result) => {
                    if(err) throw err;
                    console.log(result);
                    res.status(200).send({'message' : 'value updated'})
                  })
            })

        }
    });
});
//chart
app.get('/getchartdata/:id',(req,res) => {
    let sql = `SELECT  DATE_FORMAT(date, '%d/%m/%Y') as label, cal as y FROM saveddata WHERE user_id = ${req.params.id}`;
    let query = db.query(sql, (err,results) => {
        if(err) throw err;
        console.log(JSON.stringify(results));
        res.status(200).send(results)
    })
});



cron.schedule("59 23 * * *",()=> {
    let sql = `SELECT user_id as ids, calories as cal FROM dailycal WHERE date = '${formattedDate}'`
    console.log(sql)
    let query = db.query(sql, (error,results) => {
        if(error) throw error;
        console.log(results.length);
        console.log(results[0].ids);
        var i;
        for(i = 0; i < results.length; i++){
            id = results[i].ids;
            cal = results[i].cal;
            let row = {user_id:id, cal:cal, date:formattedDate};
            let sqlin = `INSERT INTO saveddata set ?`
            let query = db.query(sqlin, row, (err,result) => {
                if(err) throw err;
                console.log(result);
              })

        }
    })
})

cron.schedule("0 0 * * *",()=> {
    let sql = `SELECT id FROM user`
    console.log(sql)
    let query = db.query(sql, (error,results) => {
        if(error) throw error;
        console.log(results.length);
        var i;
        for(i = 0; i < results.length; i++){
            id = results[i].id;
            let row = {user_id:id, date:formattedDate};
            let sqlin = `INSERT INTO dailycal set ?`
            let query = db.query(sqlin, row, (err,result) => {
                if(err) throw err;
                console.log(result);
              })

        }
    })
})

//get activity
app.get('/activities/:id',(req,res) => {
    let sql = `SELECT weight FROM user WHERE id = ${req.params.id}`
    let query = db.query(sql, (err,results) => {
        if(err) throw err;
        userWeight = results[0].weight
        console.log(userWeight)
        var sqlActivity = ''
        if(userWeight < 69){
            sqlActivity = `SELECT name, bet57and69 as cal FROM activity_calorie`
        } else if(70 <= userWeight && userWeight <85){
            sqlActivity = `SELECT name, bet70and84 as cal FROM activity_calorie`
        } else {
            sqlActivity = `SELECT name, sup85 as cal FROM activity_calorie`
        }
        let query = db.query(sqlActivity, (err,results) => {
            if(err) throw err;
            res.status(200).send(results)
        })
    })
});

app.post('/addactivity',(req,res) => {

    id = req.body.userid;
    cal = req.body.calories;

    let researchSql = `SELECT COUNT(*) as idCount FROM dailycal WHERE user_id = "${id}" AND date = '${formattedDate}'`;
    console.log(formattedDate)
    db.query(researchSql, (error, results) => {
        if (error) throw error;
        if (results[0].idCount == 0) {
            let row = {user_id:id, activityCalorie:cal, date:formattedDate};
            let sql = 'INSERT INTO dailycal SET ?'
            let query = db.query(sql, row, (err,result) => {
              if(err) throw err;
                console.log(result);
                res.status(200).send({'message' : 'row added'});
            })
        } else {
            let sql = `SELECT activityCalorie as cal FROM dailycal WHERE user_id = "${id}" AND date = '${formattedDate}'`;
            let query = db.query(sql, (error,results) => {
                if (error) throw error;
                console.log('calorie from result: ', results[0].cal)
                calorie = results[0].cal + parseFloat(cal);
                console.log("test",calorie)
                let sqlUpdate = `UPDATE dailycal SET activityCalorie = ${calorie} WHERE user_id = ${id} AND date = '${formattedDate}'`
                console.log(sqlUpdate)
                let query = db.query(sqlUpdate, (err,result) => {
                    if(err) throw err;
                    console.log(result);
                    res.status(200).send({'message' : 'value updated'})
                  })
            })

        }
    });
});


app.get('/getpourcentage/:id',(req,res) => {
    let sql = `SELECT BMR FROM user WHERE id = ${req.params.id}`;
    let query = db.query(sql, (err,results) => {
        if(err) throw err;
        var bmr = results[0].BMR
        let sql1 = `SELECT calories,activityCalorie FROM dailycal WHERE user_id = ${req.params.id} AND date = '${formattedDate}'`;
        let query1 = db.query(sql1, (err,results) => {
        if(err) throw err;
        var activityCal = results[0].activityCalorie;
        console.log(activityCal);
        var foodCal = results[0].calories;
        console.log(foodCal)
        if (foodCal - activityCal < 0){
            console.log(activityCal - foodCal)
            res.status(200).send({'pourcentage' : 0, 'BMR' : Math.round(bmr), 'FoodCal' : foodCal, 'ActivityCal' : activityCal});

        } else if(foodCal - activityCal - bmr > 0) {
            pourcentage = 100
            res.status(200).send({'pourcentage' : 100, 'BMR' : Math.round(bmr), 'FoodCal' : foodCal, 'ActivityCal' : activityCal})
        } else {
            var pourcentage = ((foodCal - activityCal)/bmr)*100
            console.log(pourcentage)
            res.status(200).send({'pourcentage' : Math.round(pourcentage), 'BMR' : Math.round(bmr), 'FoodCal' : foodCal, 'ActivityCal' : activityCal})
        }
        })
    })
    
});





function decrypt(text) {
    let iv = Buffer.from(text.iv, 'hex');
    let encryptedText = Buffer.from(text.encryptedData, 'hex');
    let decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(key), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
}


function handleDisconnect() {
    connection = mysql.createConnection(db); // Recreate the connection, since
    // the old one cannot be reused.

    connection.connect(function (err) {              // The server is either down
        if (err) {                                     // or restarting (takes a while sometimes).
            console.log('error when connecting to db:', err);
            setTimeout(handleDisconnect, 2000); // We introduce a delay before attempting to reconnect,
        }                                     // to avoid a hot loop, and to allow our node script to
    });                                     // process asynchronous requests in the meantime.
    // If you're also serving http, display a 503 error.
    connection.on('error', function (err) {
        console.log('db error', err);
        if (err.code === 'PROTOCOL_CONNECTION_LOST') { // Connection to the MySQL server is usually
            handleDisconnect();                         // lost due to either server restart, or a
        } else {                                      // connnection idle timeout (the wait_timeout
            throw err;                                  // server variable configures this)
        }
    });
}

function calc_BMR (weight, height, gender, age, frequence_activity){    
    var gender_value = 5;
    if(gender == "female"){
        gender_value = 116;
    }
    var bmr = (weight * 10) + (6.25 * 185) - (age *5) +gender_value;
    var final_bmr = bmr * frequence_activity
    console.log(final_bmr);
    return Math.round(final_bmr);
}

function calc_BMI(w, h) {

    var s;

    hm = h/100;
    t  = w/(hm*hm);
    console.log(t);

    if(t>40){
        s =  'Very severely obese';
    }
    if(t<40 && t>35){
        s =  'Severely obese';
    }
    if(t<35 && t>30){
        s = 'Moderately obese';
    }
    if(t<30 && t>25){
        s = 'Overweight';
    }
    if(t<25 && t>18.5){
        s = 'Normal (healthy weight)';
    }
    if(t<18.5 && t>16){
        s = 'Underweight';
    }
    if(t<16 && t>15){
        s = 'Severely Underweight';
    }
    if(t<15){
        s = 'Very Severely Underweight';
    }
    var output = 'Your BMI is ' + t.toFixed(2) + ' ' + s;
    var final_bmi = {'bmi': t.toFixed(2), 'message': output}

    return final_bmi;
  
}

function encrypt(password){
    var hashedPassword = passwordHash.generate(password);
    return hashedPassword;
}
function decrypt(password, hashed_password){
    return passwordHash.verify(password, hashed_password);
}