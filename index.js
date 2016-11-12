'use strict'

const express = require('express')
const bodyParser = require('body-parser')
const request = require('request')
const app = express()
const users = ['1077146965714361', '1253903971335322']
const token = 'EAAXQIOPTDSsBAExBqmK0OpIC8ARLpVRZBeuM3FbYjeEN7rYJCO1rs9FLZBbjbncAZCEVfunLhH5ABOwYJqnOb5E2vVKTuihuN7ZBk0uAhZBiPlJ2tHZBIrwlhvJyh01zhO0Le1O9rZAhy2ZAhZBcLZCXxjX5caXXVTMVekMeJm2lcGbQZDZD'

app.set('port', (process.env.PORT || 5000))

// Process application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({extended: false}))

// Process application/json
app.use(bodyParser.json())

// Index route
app.get('/', function (req, res) {
    res.send('Hello world, I am a chat bot')
});

app.post('/webhook/', function (req, res) {
    console.log(req.body.entry[0]);
    if(req.body.entry[0].postback) {
        handlePostback(req.body.entry[0].sender.id);
        res.sendStatus(200);
    } else {
        let messaging_events = req.body.entry[0].messaging
        for (let i = 0; i < messaging_events.length; i++) {
            let event = req.body.entry[0].messaging[i];
            let sender = event.sender.id;
            console.log('sender id: ' + sender);
            if(sender === users[0]){
                console.log('master sender detected');
                broadcastMessage(sender);
            }
        }
    }
    res.sendStatus(200)
});

function handlePostback(senderId){
    console.log("postback sender id: ", senderId);
}

function broadcastMessage(sender) {
    for(var i = 0; i < users.length; i++){
        if(users[i] === sender) continue;
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
    let messageData = { text:messageText }
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
    })
}

// Spin up the server
app.listen(app.get('port'), function() {
    console.log('running on port', app.get('port'))
})
