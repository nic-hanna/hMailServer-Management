const http = require('http');
const https = require('https');
const fs = require('fs');
const express = require('express');
const crypto = require('crypto');
const app = express();
var exec = require('child_process').exec, child;
const mysql = require('mysql');
const path = require('path');
const dotenv = require('dotenv').config()

app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname,'public')));
app.use(requireHTTPS)

const privateKey  = fs.readFileSync('sslcert/privkey.pem', 'utf8');
const certificate = fs.readFileSync('sslcert/cert.pem', 'utf8');
const credentials = {
  key: privateKey,
  cert: certificate
};

var httpServer = http.createServer(app);
var httpsServer = https.createServer(credentials, app);

function requireHTTPS(req, res, next) {
  // The 'x-forwarded-proto' check is for Heroku
  if (!req.secure && req.get('x-forwarded-proto') !== 'https' && process.env.NODE_ENV !== "development") {
    return res.redirect('https://' + req.get('host') + req.url);
  }
  next();
}

var sqlCredentials = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_DB
};

function handleDisconnect() {
  con = mysql.createConnection(sqlCredentials); // Recreate the connection, since
                                                  // the old one cannot be reused.

  con.connect(function(err) {              // The server is either down
    if(err) {                                     // or restarting (takes a while sometimes).
      console.log('error when connecting to db:', err);
      setTimeout(handleDisconnect, 2000); // We introduce a delay before attempting to reconnect,
    }                                     // to avoid a hot loop, and to allow our node script to
  });                                     // process asynchronous requests in the meantime.
                                          // If you're also serving http, display a 503 error.
  con.on('error', function(err) {
    console.log('db error', err);
    if(err.code === 'PROTOCOL_CONNECTION_LOST') { // Connection to the MySQL server is usually
      handleDisconnect();                         // lost due to either server restart, or a
    } else {                                      // connnection idle timeout (the wait_timeout
      throw err;                                  // server variable configures this)
    }
  });
}

const HMS_CRED = process.env.HMS_USER + " " + process.env.HMS_PASS + " " + process.env.HMS_DOMAIN

const getCookies = (req) => {
    if (req.headers.cookie) {
        const rawCookies = req.headers.cookie.split('; ');
        const parsedCookies = {};
        rawCookies.forEach(rawCookie => {
            const parsedCookie = rawCookie.split('=');
            parsedCookies[parsedCookie[0]] = parsedCookie[1];
        });
        return parsedCookies;
    } else {
        return {};
    } 
};

function verify(auth, callback){
	var sql = "SELECT * FROM `cookies` WHERE `cookie` = '"+auth+"'";
	con.query(sql, function (err, result) {
		if (err) throw err;
		if (result != []){
			return callback(result[0]);
		} else {
			return callback([]);
		}
	});
}

app.get('/', function(req, res) {
	cookies = getCookies(req);
	if (cookies.hasOwnProperty('auth')) {
		verify(cookies.auth, function(result) {
			if (result == null || result == []) {
				res.render('login', {
					server: { name: process.env.SERVER_NAME }
				});
			} else {
				res.redirect('/dashboard')
			}
		})
	} else {
		res.render('login', {
			server: { name: process.env.SERVER_NAME }
		});
	}
});

app.post('/login', function(req, res) {
	if (req.body.username.endsWith("@va-center.com")){
		username = req.body.username;
	} else {
		username = req.body.username.split('@')[0] + '@'+process.env.HMS_DOMAIN;
	}

	exec('cscript.exe /nologo login.vbs ' + HMS_CRED + ' ' + username + ' ' + req.body.password, function (error, stdout, stderr) {
		if (stdout.startsWith("-1")){
			var token = crypto.randomBytes(16).toString('hex');
			var sql = "INSERT INTO cookies (account, cookie) VALUES ('"+username+"', '"+token+"')";
			try {
				con.query(sql, function (err, result) {
					if (err) throw err;
				});
			} catch (error) {
				console.error(error);
			}
			var sql = "DELETE FROM `cookies` WHERE `account` = '"+username+"' AND `cookie` != '"+token+"'";
			try {
				con.query(sql, function (err, result) {
					if (err) throw err;
				});
			} catch (error) {
				console.error(error);
			}
			console.log("Successful login using the account: "+username+" ("+token+")");
			res.cookie('auth',token);
			res.redirect('dashboard');
		} else {
			console.log("Invalid login attempt using the account: "+username);
			res.redirect('/');
		}
	})
});

app.get('/dashboard', function(req, res) {
	cookies = getCookies(req);
	if (cookies.hasOwnProperty('auth')) {
		verify(cookies.auth, function(result) {
			if (result == null || result == []) {
				res.redirect('/');
			} else {
				exec('cscript.exe /nologo adminLevel.vbs ' + HMS_CRED + ' ' + result.account, function (error, stdout, stderr){
					if (stdout.startsWith("1") || stdout.startsWith("2")){
						res.render('adminDashboard', {
							email: result.account,
							server: { name: process.env.SERVER_NAME }
						});
					} else {
						res.render('dashboard', {
							email: result.account,
							server: { name: process.env.SERVER_NAME }
						});
					}
				});
				
			}
		});
	} else {
		res.redirect('/');
	}
});

app.post('/editPassword', function(req, res) {
	cookies = getCookies(req);
	if (cookies.hasOwnProperty('auth')) {
		verify(cookies.auth, function(result) {
			if (result == null || result == []) {
				res.redirect('/');
			} else {
				exec('cscript.exe /nologo password.vbs ' + HMS_CRED + ' ' + result.account + ' ' + req.body.password, function (error, stdout, stderr){
					if (error == null) {
						res.redirect("/dashboard")
					} else {
						console.error(error)
					}
				});
			}
		});
	} else {
		res.redirect('/');
	}
});

app.post('/editPasswordAdmin', function(req, res) {
	cookies = getCookies(req);
	if (cookies.hasOwnProperty('auth')) {
		verify(cookies.auth, function(result) {
			if (result == null || result == []) {
				res.redirect('/');
			} else {
				// Formats address with @va-center.com
				if (req.body.username.endsWith("@va-center.com")){
					address = req.body.username;
				} else {
					address = req.body.username.split('@')[0] + '@'+process.env.HMS_DOMAIN;
				}
				// Checks admin permissions
				exec('cscript.exe /nologo adminLevel.vbs ' + HMS_CRED + ' ' + result.account, function (error, stdout, stderr){
					if (address == result.account){
						exec('cscript.exe /nologo password.vbs ' + HMS_CRED + ' ' + address + ' ' + req.body.password, function (error, stdout, stderr){
							if (error == null) {
								res.redirect("/dashboard")
							} else {
								console.error(error)
							}
						});
					} else if (stdout.startsWith("1")){
						exec('cscript.exe /nologo adminLevel.vbs ' + HMS_CRED + ' ' + address, function (error, stdout, stderr){
							if (stdout.startsWith("1") || stdout.startsWith("2")){
								res.redirect("/dashboard")
							} else {
								exec('cscript.exe /nologo password.vbs ' + address + ' ' + req.body.password, function (error, stdout, stderr){
									if (error == null) {
										res.redirect("/dashboard")
									} else {
										console.error(error)
									}
								})
							}
						});
					} else if (stdout.startsWith("2")) {
						exec('cscript.exe /nologo adminLevel.vbs ' + HMS_CRED + ' ' + address, function (error, stdout, stderr){
							if (stdout.startsWith("2")){
								res.redirect("/dashboard")
							} else {
								exec('cscript.exe /nologo password.vbs ' + HMS_CRED + ' ' + address + ' ' + req.body.password, function (error, stdout, stderr){
									if (error == null) {
										res.redirect("/dashboard")
									} else {
										console.error(error)
									}
								})
							}
						});
					} else {
						res.redirect('dashboard');
					}
				});
			}
		});
	} else {
		res.redirect('/');
	}
});

app.post('/createUser', function(req, res) {
	cookies = getCookies(req);
	if (cookies.hasOwnProperty('auth')) {
		verify(cookies.auth, function(result) {
			if (result == null || result == []) {
				res.redirect('/');
			} else {
				exec('cscript.exe /nologo adminLevel.vbs ' + HMS_CRED + ' ' + result.account, function (error, stdout, stderr){
					if (stdout.startsWith("1") || stdout.startsWith("2")){
						if (req.body.username.endsWith('@'+process.env.HMS_DOMAIN)){
							address = req.body.username;
						} else {
							address = req.body.username.split('@')[0] + '@'+process.env.HMS_DOMAIN;
						}
						exec('cscript.exe /nologo create.vbs ' + HMS_CRED + ' ' + address + ' ' + req.body.password, function (error, stdout, stderr){
							if (error == null) {
								console.log(stdout)
								res.redirect("/dashboard")
							} else {
								console.error(error)
							}
						});
					} else {
						res.redirect('dashboard');
					}
				});
			}
		});
	} else {
		res.redirect('/');
	}
});

app.post('/logout', function(req, res) {
	cookies = getCookies(req);
	if (cookies.hasOwnProperty('auth')) {
		verify(cookies.auth, function(result) {
			console.log(result.account + " has logged out (" + cookies.auth + ")");
			if (result == null || result == []) {
				res.redirect('/');
			} else {
				var sql = "DELETE FROM `cookies` WHERE `account` = '"+result.account+"'";
				try {
					con.query(sql, function (err, result) {
						if (err) throw err;
						res.redirect('/');
					});
				} catch (error) {
					console.error(error);
				}
			}
		});	
	} else {
		res.redirect('/');
	}
});
httpServer.listen(80);
httpsServer.listen(443);