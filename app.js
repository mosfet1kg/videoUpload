var express = require('express'),
    app = express(),
    fs = require('fs'),
    exec = require('child_process').exec,
    path = require('path');

var server = app.listen(8080, function(){
        console.log('This server is running on the port ' + this.address().port);
    }
);

var io = require('socket.io').listen(server);

var Files = [];

app.use(express.static(__dirname));


io.sockets.on('connection', function (socket) {

    socket.on('Start', function (data) { //data contains the variables that we passed through in the html file
        var Name = data['Name'];
        Files[Name] = {  //Create a new Entry in The Files Variable
            FileSize : data['Size'],
            Data     : "",              //buffer
            Downloaded : 0
        };

        var Place = 0;
        try{
            var stat = fs.statSync('Temp/' +  Name);
            if(stat.isFile())
            {
                Files[Name]['Downloaded'] = stat.size;
                Place = stat.size / 524288;
            }
        }
        catch(er){} //It's a New File
        fs.open("Temp/" + Name, "a", 0755, function(err, fd){
            if(err)
            {
                console.log(err);
            }
            else
            {
                Files[Name]['Handler'] = fd; //We store the file handler so we can write to it later
                socket.emit('MoreData', { 'Place' : Place, Percent : 0 });
            }
        });
    });

    socket.on('Upload', function (data){
        var Name = data['Name'];
        Files[Name]['Downloaded'] += data['Data'].length;
        Files[Name]['Data'] += data['Data'];
        if(Files[Name]['Downloaded'] == Files[Name]['FileSize']) //If File is Fully Uploaded
        {
            fs.write(Files[Name]['Handler'], Files[Name]['Data'], null, 'Binary', function(err, Written){
                //Get Thumbnail Here
                var readS = fs.createReadStream("Temp/" + Name);
                var writeS = fs.createWriteStream("Video/" + Name);
                readS.pipe(writeS);  //https://groups.google.com/forum/#!msg/nodejs/YWQ1sRoXOdI/3vDqoTazbQQJ

                readS.on('end', function(){
                    //Operation done
                    fs.unlink("Temp/" + Name, function () { //This Deletes The Temporary File
                        //Moving File Completed
                        //exec("ffmpeg -i Video/" + Name  + " -ss 01:30 -r 1 -an -vframes 1 -f mjpeg Video/" + Name  + ".jpg", function(err){
                        //    socket.emit('Done', {'Image' : 'Video/' + Name + '.jpg'});
                        //    delete Files[Name];
                        //    console.log(Files[Name]);
                        //});
                        socket.emit('Done', {'Image' : 'Video/' + Name + '.jpg'});
                    });
                });
            });
        }
        else if(Files[Name]['Data'].length > 10485760){ //If the Data Buffer reaches 10MB
            fs.write(Files[Name]['Handler'], Files[Name]['Data'], null, 'Binary', function(err, writen){
                Files[Name]['Data'] = ""; //Reset The Buffer
                var Place = Files[Name]['Downloaded'] / 524288;
                var Percent = (Files[Name]['Downloaded'] / Files[Name]['FileSize']) * 100;
                socket.emit('MoreData', { 'Place' : Place, 'Percent' :  Percent});
            });
        }
        else
        {
            var Place = Files[Name]['Downloaded'] / 524288;
            var Percent = (Files[Name]['Downloaded'] / Files[Name]['FileSize']) * 100;
            socket.emit('MoreData', { 'Place' : Place, 'Percent' :  Percent});
        }
    });


});