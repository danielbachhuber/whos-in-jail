/**
 * Scrape the website and provide the data as JSON
 */
var request = require('request');
var cheerio = require('cheerio');
var fs      = require('fs');

var args = new Object();
process.argv.forEach(function(val, index, array) {
	args[index] = val;
});

var inmateScraper = {};

inmateScraper.fields = new Array(
		'id',
		'name',
		'book_date',
		'charge',
		'bail',
		'scheduled_release_date'
	);

inmateScraper.inmateUrlBase = 'http://www.co.yamhill.or.us/sheriff/inmates/';

inmateScraper.downloadSrc = function() {
	request( this.inmateUrlBase+'icurrent.htm',function( error, response, body ){
		 
		 if ( !error && response.statusCode == 200 ) {

		 	fs.writeFileSync('./src/icurrent.htm',body,{encoding:'utf8'});
		 	var inmates = inmateScraper.inmatesTableAsJson( body );
		 	inmates.forEach(function(obj,i){
		 		request( inmateScraper.inmateUrlBase+obj.file,function( error, response, body ){
		 			if ( !error && response.statusCode == 200 ) {
		 				fs.writeFileSync('./src/'+obj.file,body,{encoding:'utf8'});
		 			}
		 		});
		 	});
		 }
	});
}

/**
 * Refresh JSON /src
 */
inmateScraper.refreshJson = function() {

	var fileData = fs.readFileSync('./src/icurrent.htm',{encoding:'utf8'});
	if ( fileData.length == 0 )
		return;

	var inmates = inmateScraper.inmatesTableAsJson( fileData );

	inmates.forEach(function(obj,i){

		if ( typeof obj.file == 'undefined' )
			return;

		var inmateFileData = fs.readFileSync('./src/'+obj.file,{encoding:'utf8'});
		var inmateProfile = inmateScraper.inmatesProfileTableAsJson( inmateFileData );

		for( prop in inmateProfile ) {
			obj[prop] = inmateProfile[prop];
		}

	});

	inmateScraper.writeJsonToFile(inmates,'all.json');
}


inmateScraper.inmatesTableAsJson = function( html ) {

	var inmates_data = new Array;

	var $ = cheerio.load( html );

	// HTML on the page is a poorly formed table, so let's depend on rows
	$('tr').each(function(i,el){

		// Not an inmate row
		if ( 6 !== $(this).find('td').length )
			return;

		// Real table header
		if ( '#' == $(this).find('td').eq(0).text() )
			return;

		var inmate_data = new Object();

		$(this).find('td').each(function(j){
			var field = inmateScraper.fields[j];
			inmate_data[field] = $(this).text().trim();

			if ( 1 == j ) {
				inmate_data['file'] = $(this).find('a').attr('href');
			}

		});

			inmates_data[i] = inmate_data;

	});
	return inmates_data;
}

inmateScraper.inmatesProfileTableAsJson = function( html ) {

	var inmateProfileData = new Object;
	var $ = cheerio.load( html );

	var process_next = '';
	$('tr').each(function(j){

		// Handle charges
		if ( $(this).find('td').eq(1).text() == 'Disposition' ) {
        	process_next = 'charges';
        	inmateProfileData['charges'] = new Array();
			return;
        }
        if ( process_next == 'charges' ) {
        	var charge = new Object;
        	charge['offense'] = $(this).find('td').eq(0).text().trim();
        	charge['disposition'] = $(this).find('td').eq(1).text().trim();
        	charge['sentence'] = $(this).find('td').eq(2).text().trim();

        	if ( charge['offense'].length == 0 )
        		return;

        	inmateProfileData['charges'].push( charge );
        }

	});
	return inmateProfileData;
}

inmateScraper.writeJsonToFile = function( data, file ) {
	fs.writeFileSync('./data/'+file,JSON.stringify(data,null,"\t"),{encoding:'utf8'});
}

if ( args[2] == 'download-src' )
	inmateScraper.downloadSrc();
else
	inmateScraper.refreshJson();