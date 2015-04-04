var fs = require('fs');
var child = require('child_process');
var express = require('express');
var bodyParser = require('body-parser')

var config = require('./config.js');


var app = express();
var logfile = 'deploy.log';
var errors = [
    null,
    'parser',
    'token',
    'repository',
    'locked'
];


function savelog(message, level) {
    var date = new Date(),
        text = [
            date.toString(),
            level || 'INFO',
            message
        ].join(' - ');

    fs.appendFile(logfile, text + '\n');
    console.log(text);
}


app.enable('trust proxy');

app.get('/', function (req, res) {
    res.send('Hello World!' + new Date());
});

app.get('/log', function (req, res) {
    fs.readFile(logfile, 'utf8', function (err, data) {
        if (err) return;
        savelog('/log');
        res.send(data);
    });
});

app.post('/hook', bodyParser.urlencoded({ extended: false }), function (req, res) {
    var error = 0
    
    savelog('/hook');
    
    if (req.body && req.body.payload) {
        var token = req.query.token,
            payload = JSON.parse(req.body.payload);
        
    	if (token && config[token]) {
            var conf = config[token];

            if (conf.name === payload.repository.name) {
    	        savelog('deploy start ' + payload.repository.name);
                savelog("commits: \n" + payload.commits.map(function (c) {
                    return '     ' + c.message.replace("\n", '') + ' (' + c.author + ')';
                }).join("\n"));

                if (!conf.lock) {
                    conf.lock = true;
                    savelog('git pull');
                    
                    var commands = [
                        'cd ' + conf.folder,
                        'git pull',
                        'test -e .deploy && bash .deploy'
                    ];
                    child.exec(commands.join(';'), function (err, stdout, stderr) { 
                        stdout && savelog(stdout);
                        stderr && savelog(stderr, 'ERROR');
                        err && savelog(err, 'ERROR');
                            
                        conf.lock = false;
                        savelog('done...'); 
                    });
                    
                    res.send('ok');
                    return;
                } else {
                    error = 4;
                }
            } else {
                error = 3;
            }
        } else {
            error = 2;
        }
    } else {
        error = 1;
    }

    if (error !== 0) {
        savelog('error ' + errors[error], 'ERROR');
        res.send('ERROR');
    }
});

app.listen(3002);
