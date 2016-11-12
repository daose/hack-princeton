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
const users = ['1077146965714361', '1253903971335322' , '1249520891776599'];
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

var counted=0;

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
                broadcastMessage(sender, event.message.attachments[0].payload);
            }
        }
    }
    res.sendStatus(200);
});

function handlePostback(sender, postback){
    console.log("handlePostback: ", postback);
    var userRef = split.child("splitter");
    //get the value of split.recepient
    split.child("receipient").once('value').then(function(snapshot) {
    //if the receipient tries to send money to himself, ignore it 
        if(sender !== snapshot.val()){
            userRef.child(sender).once('value').then(function(snap){
                var senderResponse = snap.val();
                if((senderResponse == undefined || senderResponse==="no") && postback.payload==="yes") counted++;
                if(senderResponse==="yes" && postback.payload==="no") counted--;
            });

            userRef.child(sender).set(postback.payload);
        }
    });
}

function broadcastMessage(sender, imagePayload) {
    console.log("image url: ", imagePayload.url);
    console.log('ocp url: ', ocpUrl);
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
            sendPromptMessage(users[i], "yes/no?");
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

function sendPromptMessage(senderId, messageText) {
    let messageData = {
        recipient: {
            id: senderId
        },
        message: {
            attachment: {
                type: "template",
                payload: {
                    template_type: "button",
                    text: messageText,
                    buttons: [{
                        type: "postback",
                        title: "yes",
                        payload: "yes"
                    }, {
                        type: "postback",
                        title: "no",
                        payload: "no"
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

function splitMoney(){

}

// Spin up the server
app.listen(app.get('port'), function() {
    console.log('running on port', app.get('port'));
});
