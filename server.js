﻿var express			= require('express');
var session			= require('express-session');
var cors			= require('cors')
var request			= require('request');
var cheerio			= require('cheerio');
var bodyParser		= require('body-parser');
var port			= process.env.PORT || 7881;

var app = express();
app.use(bodyParser.json())
app.use(bodyParser.json());         // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({
									// to support URL-encoded bodies
	extended: true
}));

app.use(session({
	name: 'TaizBiskut',
	secret: 'oRsZmO1LwIyx563DC1V3', 
	resave: true,
	saveUninitialized: true,
    cookie: false,
    headerName: 'TaizBiskut'
}))

app.use(cors());		// For allowing Ajax to access out API

var NeonURL = 'http://nu.edu.pk/NeONStudent/';

// Remember Cookies
//var request = request.defaults({ jar: true }) // Saving it in session

app.get('/', function(req, res){
    res.send({message:'hello world'});
});

app.get('/load', function (req, res) {
	// Create Cookie jar	
	req.session.cookies = request.jar()
	request = request.defaults({ jar: req.session.cookies })
	
	request(NeonURL, function (error, response, html) {

		if (!error) {
			var $ = cheerio.load(html);
			req.session.LoginData = {};
			req.session.LoginData.__EVENTTARGET = $('#__EVENTTARGET').attr('value');
			req.session.LoginData.__EVENTARGUMENT = $('#__EVENTARGUMENT').attr('value');
			req.session.LoginData.__VIEWSTATE = $('#__VIEWSTATE').attr('value');
			req.session.LoginData.__EVENTVALIDATION = $('#__EVENTVALIDATION').attr('value');
			req.session.LoginData.ddlCampus = 'PWR';
			req.session.LoginData.username = '';
			req.session.LoginData.password = '';
			req.session.LoginData.showPassword = 'on';
			req.session.LoginData.txtUserCaptcha = '';
			req.session.LoginData.submit = 'Log in';
			req.session.LoginData.login1_ClientState = '';
			
			captchaImgURI = NeonURL + $('img[src^=CaptchaImage]').attr('src');
			request({ url: captchaImgURI, encoding: null }, function (error, response, data) {
				if (!error && response.statusCode == 200) {
					var captchaImgData = 'data:' + response.headers['content-type'] + ';base64,' + data.toString('base64');
					res.send({captcha:captchaImgData, token:req.sessionID});
				} 
				else {
					res.send({message:"Error getting image."});
				}
			});
		}
	});
})

// Done - Need to add error handling
app.post('/login', function (req, res) {
	console.log("Login POST");
	if (!req.session.LoginData && !req.session.cookies) { 
		res.send({message:"First request /load to continue."});
		return;
	}
	console.log("Login POST: Condition successfull");
	// Get Saved Cookies
	request = request.defaults({ jar: req.session.cookies })
	
	// Get value add in session by Load
	req.session.LoginData.campus = req.body.campus;
	req.session.LoginData.username = req.body.username;
	req.session.LoginData.password = req.body.password;
	req.session.LoginData.txtUserCaptcha = req.body.captcha;
	
	console.log(req.session.campus);

	request.post({ url: NeonURL, form: req.session.LoginData }, function (error, response, body) {
		if (!error && response.statusCode == 302) {
			res.statusCode = 202;
			req.session.LoggedIn = true;
			res.send({message:"Login successfull!"});
		}
		else {
			res.statusCode = 401; 
			if (body.indexOf("Invalid Code") != -1) {
				res.send({message:"Invalid captcha value!"});
			}
			else if (body.indexOf("Login Failed.Try Again") != -1) {
				res.send({message:"Invalid username or password!"});
			}
			else if (body.indexOf("connection") != -1) {
				res.send({message:"Server switch off!"});
			}
			else {
				res.send({message:"Failed to login without any reason!s"});
			}
		}
	})
})

//Done
app.get('/student', function (req, res) {
	if (!req.session.LoginData && !req.session.cookies) { 
		res.send({message:'login first'});
		return;
	}
	
	// Get Saved Cookies
	request = request.defaults({ jar: req.session.cookies })

	request(NeonURL + '/ViewStudentProfile.aspx', function (error, response, html) {
	//request('http://localhost/NeonSample/Main.html', function (error, response, html) {
		if (!error) {
			var $ = cheerio.load(html);
			var student = {};
			student.name = $('#MainContent_fvPersonal_lblName').text();
			student.rollno = $('#MainContent_fvPersonal_lblRollno').text();
			student.degree = $('#MainContent_fvPersonal_lblDegree').text();
			student.batch = $('#MainContent_fvPersonal_lblBatch').text();
			student.campus = $('#MainContent_fvPersonal_lblCampus').text();
			student.email = $('#MainContent_fvPersonal_lblEmail').text();
			
			res.send({result:JSON.stringify(student, null, 2)});
		}
		else {
			res.send({message:"Fail to get data."});
		}
	})
})

// Done
app.get('/logout', function (req, res) {
	req.session.destroy();
	res.send({message:"Have a good day!"});
})

//Done
app.get('/attendence', function (req, res) {
	if (!req.session.LoginData && !req.session.cookies) { 
		res.send({message:'login first'});
		return;
	}
	
	// Get Saved Cookies
	request = request.defaults({ jar: req.session.cookies })

	request(NeonURL + '/Registration/ViewStudentAttendance.aspx', function (error, response, html) {
		if (!error) {
			var $ = cheerio.load(html);
			var json = [];			
			
			$("#MainContent_pnlRegCourses > table").each(function (index, item) {
				var tableInfo = {};
				tableInfo.title = $(item).find("span").first().text().trim();
				
				var attendence = [];
				$(item).find('.grid-viewForAttendance > tr:nth-child(2) td').each(function (j, cell) {
					var data = $(cell).text().trim();
					if (data) attendence.push([data]);
				});

				tableInfo.attendence = attendence;							

				json.push(tableInfo);				
			});
			
			for (var data in json) {
				console.log();
				var percentage = json[data].attendence.pop()
				var presentHour = json[data].attendence.pop()
				var absentHour = json[data].attendence.pop()
				json[data].percentage = percentage;
				json[data].presentHour = presentHour;
				json[data].absentHour = absentHour;
			}
			
			res.send({result:JSON.stringify(json, null, 2)});
		}
		else {
			res.send({message:"Fail to get data."});
		}
	})

})

app.get('/marks', function (req, res) {
	if (!req.session.LoginData && !req.session.cookies) {
		res.send({message:'login first'});
		return;
	}
	
	// Get Saved Cookies
	request = request.defaults({ jar: req.session.cookies })

	//request('http://localhost/NeonSample/Marks.html', function (error, response, html) {
	request(NeonURL + '/Registration/StudentMArksEvaluations.aspx', function (error, response, html) {
		if (!error) {
			var $ = cheerio.load(html);
			var json = [];
			
			$("#MainContent_pnlRegCourses > table").each(function (index, item) {
				var tableInfo = {};
				tableInfo.title = $(item).find("span").first().text().trim();
				
				var marks = [];
				$(item).find('.grid-view > tr:nth-child(2) td').each(function (j, cell) {
					var data = $(cell).text().trim();
					if (data) marks.push({your:data});
				});
				
				tableInfo.marks = marks;
				
				json.push(tableInfo);
			});
						
			res.send({result:JSON.stringify(json, null, 2)});
		}
		else {
			res.send({message:"Fail to get data."});
		}
	})

})

//Done
app.get('/courses', function (req, res) {
	if (!req.session.LoginData && !req.session.cookies) {
		res.send({message:'login first'});
		return;
	}
	
	// Get Saved Cookies
	request = request.defaults({ jar: req.session.cookies })
	
	request(NeonURL + '/Registration/StudentREgistration.aspx', function (error, response, html) {
	//request('http://localhost/NeonSample/RegisteredCourse.html', function (error, response, html) {
		if (!error) {
			var $ = cheerio.load(html);
			var json = {};
			json.cgpa = $('#MainContent_lblCGPA').text();
			json.CreditEarned = $('#MainContent_lblCrErn').text();
			json.CreditLimit = $('#MainContent_lblCreditLimit').text();
			json.CurrentCredit = $('#MainContent_lblCredits').text();
			json.warning = $('#MainContent_lblWarning').text();
			
			var courses = [];
			var headers = [];
			
			var calls = [];
			
			$('#MainContent_GVRegisterCourses th').each(function (index, item) {
				headers[index] = $(item).html();
			})
			
			$('#MainContent_GVRegisterCourses tr').has('td').each(function () {
				var CourseInfo = {};
				$('td', $(this)).each(function (index, item) {
					CourseInfo[headers[index]] = $(item).text().replace(/[\t\n]+/g, ' ').trim();
				});
				courses.push(CourseInfo);
			});
			
			json.courses = courses;
			res.send({result:JSON.stringify(json, null, 2)});
		}
		else {
			res.send({message:"No course registered."});
		}
	})
	console.log("Leaving");
})

// Done
app.get('/challan', function (req, res) {
	if (!req.session.LoginData && !req.session.cookies) {
		res.send({message:'login first'});
		return;
	}
	
	// Get Saved Cookies
	request = request.defaults({ jar: req.session.cookies })

	request(NeonURL + '/FMS/GenerateChallan.aspx', function (error, response, html) {
	//request('http://localhost/NeonSample/Challan.html', function (error, response, html) {
		console.log("In courses request");
		if (!error) {
			var $ = cheerio.load(html);
			var json = {};
			var challans = [];
			var headers = [];
			$('#MainContent_gvChallan th').each(function (index, item) {
				headers[index] = $(item).html();
			});
			$('#MainContent_gvChallan tr').has('td').each(function () {
				var ChalanInfo = {};
				$('td', $(this)).each(function (index, item) {
					ChalanInfo[headers[index]] = $(item).text().replace(/[\t\n]+/g, ' ').trim();
				});
				console.log(ChalanInfo);
				challans.push(ChalanInfo);
			})
			json = challans;
			
			res.send({result:JSON.stringify(json, null, 2)});
		}
		else {
			res.send({message:"No chalan to show."});
		}
	})
})

app.listen(port)
console.log('Magic happens on port 80');