/*jshint esversion: 6 */
/*jshint node: true*/
/*jshint unused: false */

'use strict';
const admin = require('firebase-admin');
const serviceAccount = require('./hack-princeton-firebase-adminsdk-x9bdc-d39b75de21.json');
const express = require('express');
const bodyParser = require('body-parser');
const request = require('request');
const app = express();
const users = ['1077146965714361', '1253903971335322', '1249520891776599'];
const customerId = ['5827562a360f81f104547b3e', '582756a2360f81f104547b3f', '5827570d360f81f104547b40'];
const token = 'EAAXQIOPTDSsBAExBqmK0OpIC8ARLpVRZBeuM3FbYjeEN7rYJCO1rs9FLZBbjbncAZCEVfunLhH5ABOwYJqnOb5E2vVKTuihuN7ZBk0uAhZBiPlJ2tHZBIrwlhvJyh01zhO0Le1O9rZAhy2ZAhZBcLZCXxjX5caXXVTMVekMeJm2lcGbQZDZD';
const ocpKey = '6d5e8cdca22c4b8085c572feded478db';
const nessie = "http://api.reimaginebanking.com";
const nessieKey = "5d5c8329d6efe2ee07156e373d9abbbc";
const ocpUrl = 'https://api.projectoxford.ai/vision/v1.0/ocr';
const rePattern = new RegExp(/\$(\d+\.\d\d)/);

//Firebase Init
admin.initializeApp({
     credential: admin.credential.cert(serviceAccount),
     databaseURL: "https://hack-princeton.firebaseio.com"
});
var db = admin.database();
var dbRef = db.ref("bot");
var split = dbRef.child("split");

//Server Init
app.set('port', (process.env.PORT || 5000));
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());

// Index route
app.get('/', function (req, res) {
    res.send('Hello world, I am a chat bot');
});

app.post('/webhook/', function (req, res) {
    let events = req.body.entry[0].messaging;
    console.log(events);
    for(let i = 0; i < events.length; i++){
        let event = req.body.entry[0].messaging[i];
        let sender = event.sender.id;
        if(event.postback){
            handlePostback(sender, event.postback);
        } else {
            if(event.message.attachments){
                console.log(event.message.attachments[0].payload);
                broadcastMessage(sender, event.message.attachments[0].payload);
            } else if (event.message.text.toLowerCase() === "check balance") {
                checkBalance(sender);
            }
        }
    }
    res.sendStatus(200);
});


function deposit(accountId, amount){
    let nessieDepositEndpoint = nessie + "/accounts/" + accountId + "/deposits";
    request({
        url: nessieDepositEndpoint,
        qs: {key: nessieKey},
        method: 'POST',
        json: {
            medium: 'balance',
            transaction_date: getTheDate(),
            amount: amount,
            description: "na"
        }
    }, function(error, response, body) {
        if(error){
            console.log('Error sending message: ', error);
        } else if(response.body.error){
            console.log('Error: ', response.body.error);
        }
        console.log("deposit: ", body);
    });
}

function withdrawal(accountId, amount){
    let nessieWithdrawalEndpoint = nessie + "/accounts/" + accountId + "/withdrawals";
    request({
        url: nessieWithdrawalEndpoint,
        qs: {key: nessieKey},
        method: 'POST',
        json: {
            medium: 'balance',
            transaction_date: getTheDate(),
            amount: amount,
            description: "na"
        }
    }, function(error, response, body) {
        if(error){
            console.log('Error sending message: ', error);
        } else if(response.body.error){
            console.log('Error: ', response.body.error);
        }
        console.log("withdrawal: ", body);
    });
}

function checkBalance(sender) {
    dbRef.child("table").child(sender).once("value").then(function(snapshot) {
        let nessieAccountEndpoint = nessie + "/accounts/" + snapshot.val();
        request({
            url: nessieAccountEndpoint,
            qs: {key: nessieKey},
            method: 'GET'
        }, function(error, response, body) {
            if(error) {
                console.log('Error sending message: ', error);
            } else if (response.body.error) {
                console.log('Error: ', response.body.error);
            }
            var json = JSON.parse(body);
            sendTextMessage(sender, json.balance);
        });
    });
}

function handlePostback(sender, postback){
    console.log("handlePostback: ", postback);
    split.child('splitter').child(sender).set(postback.payload);
    split.once('value').then(function(snapshot) {
        if(snapshot.child('splitter').numChildren() === users.length - 1){
            splitMoney(snapshot.exportVal());
        }
    });
}

function broadcastMessage(sender, imagePayload) {
    request({
        method: 'POST',
        url: ocpUrl,
        headers: {
            'Ocp-Apim-Subscription-Key': ocpKey,
            'Content-Type': 'application/json'
        },
        json: {
            url: imagePayload.url
        }
    }, function(error, response, body) {
        if(error){
            console.log('Error sending message: ', error);
        } else if (response.body.error){
            console.log('Error: ', response.body.error);
        }
        var totalAmount = ocrFindTotal(body, 0);
        reset(sender, totalAmount);
         
        for(var i = 0; i < users.length; i++){
            if(users[i] === sender) {
                continue;
            }
            sendPromptMessage(users[i], String(getName(sender)) + " wants to split a total of $" + totalAmount.toFixed(2) + "?", imagePayload.url);
        }
    });
}

function ocrFindTotal(body, totalAmount) {
    for(var i in body) {
        if(typeof body[i] === 'object'){
            totalAmount = ocrFindTotal(body[i], totalAmount);
        } else {
            var value = body[i].toString();
            var matches = value.match(rePattern);
            if(matches){
                var amount = parseFloat(matches[1]);
                if(amount > totalAmount){
                    totalAmount = amount;
                }
            }
        }
    }
    return totalAmount;
}

function sendPromptMessage(senderId, messageText, imageURL) {
    let messageData = {
        recipient: {
            id: senderId
        },
        message: {
            attachment: {
                type: "template",
                payload: {
                    template_type: "generic",
                    elements: [{
                        title: messageText,
                        image_url: imageURL,
                        item_url: imageURL,
                        buttons: [{
                            type: "postback",
                            title: "yes",
                            payload: "yes"
                        }, {
                            type: "postback",
                            title: "no",
                            payload: "no"
                        }]
                    }]
                }
            }
        }
    };
    request({
        url: 'https://graph.facebook.com/v2.6/me/messages',
        qs: { access_token: token },
        method: 'POST',
        json: messageData
    }, function(error, response, body) {
        if(error){
            console.log('Error sending message: ', error);
        } else if (response.body.error) {
            console.log('Error: ', response.body.error);
        }
    });
}

function sendTextMessage(recipientId, messageText) {
    let messageData = { text:messageText };
    request({
        url: 'https://graph.facebook.com/v2.6/me/messages',
        qs: { access_token: token },
        method: 'POST',
        json: {
            recipient: {id:recipientId},
            message: messageData
        }
    }, function(error, response, body) {
        if(error){
            console.log('Error sending message: ', error);
        } else if (response.body.error) {
            console.log('Error: ', response.body.error);
        }
    });
}

function reset(sender, theAmount){
    split.set({
        "receipient" : sender,
        "amount" : theAmount
    });
}

function splitMoney(splitObject){
    dbRef.child("table").once("value").then(function(snapshot) {
        var rAId = snapshot.child(splitObject.receipient).val();
        var amount = splitObject.amount;
        var count = 0;
        for(var obj in splitObject.splitter){
            if(splitObject.splitter.hasOwnProperty(obj)){
                if(splitObject.splitter[obj] === 'yes'){
                    count++;
                }
            }
        }
        amount = amount / (count + 1);
        for(var key in splitObject.splitter){
            if(splitObject.splitter.hasOwnProperty(key)){
                var sAId = snapshot.child(key).val();
                if(splitObject.splitter[key] === 'yes'){
                    withdrawal(sAId, amount);
                    deposit(rAId, amount);
                    sendTextMessage(key, "$" + amount.toFixed(2) + " was transferred to the recipient");
                }
            }
        }
        sendTextMessage(splitObject.receipient, "$" + (count * amount).toFixed(2) + " was deposited into your account.");
        split.set({});
    });
}

function getName(fid){
    var theURL = "https://graph.facebook.com/v2.6/" + fid +"?fields=first_name,last_name,profile_pic,locale,timezone,gender&access_token=" + token;
    console.log(theURL);
    request({
        url: theURL,
        method: 'GET'
    }, function(error, response, body) {
        if(error){
            console.log('Error sending message: ', error);
        } else if(response.body.error){
            console.log('Error: ', response.body.error);
        }
        var json =JSON.parse(body);
        var fullName = json.first_name.toString() + " " + json.last_name.toString();
        return String(fullName);
    });
}

function getTheDate(){
    var d = new Date();
    var theDate= d.getFullYear() + "-" + (d.getMonth()+1) + "-" + d.getDate();
    return theDate;
}
// Spin up the server
app.listen(app.get('port'), function() {
    console.log('running on port', app.get('port'));
});
