/*jshint esversion: 6 */
/*jshint node: true*/

'use strict';
const admin = require('firebase-admin');
const serviceAccount = require('./hack-princeton-firebase-adminsdk-x9bdc-d39b75de21.json');
const express = require('express');
const bodyParser = require('body-parser');
const request = require('request');
const app = express();
const users = ['1077146965714361', '1253903971335322'];
const token = 'EAAXQIOPTDSsBAExBqmK0OpIC8ARLpVRZBeuM3FbYjeEN7rYJCO1rs9FLZBbjbncAZCEVfunLhH5ABOwYJqnOb5E2vVKTuihuN7ZBk0uAhZBiPlJ2tHZBIrwlhvJyh01zhO0Le1O9rZAhy2ZAhZBcLZCXxjX5caXXVTMVekMeJm2lcGbQZDZD';

//Firebase Init
admin.initializeApp({
     credential: admin.credential.cert(serviceAccount),
     databaseURL: "https://hack-princeton.firebaseio.com"
});

var db = admin.database();
var dbRef = db.ref("bot");

app.set('port', (process.env.PORT || 5000));

// Process application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({extended: false}));

// Process application/json
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
            if(sender === users[0]){
                console.log("temp master sender detected");
                broadcastMessage(sender);
            }
        }
    }
    res.sendStatus(200);
});

function handlePostback(sender, postback){
    console.log("handlePostback: ", postback);
    var userRef = dbRef.child(sender);
    userRef.set({
        "sender": sender,
        "response": postback.payload
    });
}

function broadcastMessage(sender) {
    for(var i = 0; i < users.length; i++){
        if(users[i] === sender) {
            continue;
        }
        sendPromptMessage(users[i], "yes/no?");
    }
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

// Spin up the server
app.listen(app.get('port'), function() {
    console.log('running on port', app.get('port'));
});
