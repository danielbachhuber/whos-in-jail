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

inmateScraper.srcDir = './src/';

inmateScraper.inmateUrlBase = 'http://www.co.yamhill.or.us/sheriff/inmates/';

inmateScraper.refreshSrc = function() {

	var srcDir = inmateScraper.srcDir;

	if ( ! fs.existsSync( srcDir ) )
		fs.mkdirSync(srcDir);

	request( inmateScraper.inmateUrlBase+'icurrent.htm',function( error, response, body ){
		 
		 if ( !error && response.statusCode == 200 ) {

		 	fs.writeFileSync(srcDir+'icurrent.htm', body);
		 	console.log("wrote icurrent.html");
		 	var inmates = inmateScraper.inmatesTableAsJson( body );
		 	inmates.forEach(function(obj,i){
		 		request( inmateScraper.inmateUrlBase+obj.file,function( error, response, body ){
		 			if ( !error && response.statusCode == 200 ) {
		 				fs.writeFileSync(srcDir+obj.file, body);
		 				console.log("wrote "+obj.file);
		 			} else {
		 				console.log("ERROR downloading"+obj.file)
		 			}
		 		});
		 	});
		 } else {
		 	console.log("error downloading icurrent.html", error, response, body);
		 }
	});
}

/**
 * Refresh JSON /src
 */
inmateScraper.readAsJson = function() {

	var fileData = fs.readFileSync(inmateScraper.srcDir+'icurrent.htm');
	if ( fileData.length == 0 )
		return new Object;

	var inmates = inmateScraper.inmatesTableAsJson( fileData );

	inmates.forEach(function(obj,i){

		if ( typeof obj.file == 'undefined' )
			return;

		var inmateFileData = fs.readFileSync(inmateScraper.srcDir+obj.file);
		var inmateProfile = inmateScraper.inmatesProfileTableAsJson( inmateFileData );

		for( prop in inmateProfile ) {
			obj[prop] = inmateProfile[prop];
		}

	});
	return inmates;
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

		inmates_data.push(inmate_data);
	});
	return inmates_data;
}

inmateScraper.inmatesProfileTableAsJson = function( html ) {

	var inmateProfileData = new Object;
	var $ = cheerio.load( html );

	var process_next = '';
	$('tr').each(function(j){

		// Handle the inmate details at the top of the page
		// Cheerio doesn't seem to work with attr() :(
		if ( $(this).html().match(/height=\"248\"/ ) ) {
			var profileDetails = $(this).text();
			var profilePatterns = {
					'file_number':'File Number : ([\\d]+)',
					'arrest_date':'Arrest Date .. : ([\\d]+\\/[\\d]+\\/[\\d]+)',
					'book_date':'Booking Date : ([\\d]+\\/[\\d]+\\/[\\d]+)',
					'scheduled_release_date':'Scheduled Release Date : ([\\d]+\\/[\\d]+\\/[\\d]+)',
					'eye':'Eyes : ([A-Za-z]+)',
					'hair':'Hair .. : ([A-Za-z]+)',
					'age':'Age... : ([0-9]+)',
					'sex':'Sex... : ([A-Za-z])',
					'fines':'Total Fines : \\$\\s+([\\d\\.]+)',
					'bond':'Total Bond : \\$\\s+([\\d\\.]+)',
					'bail':'Total Bail.. : \\$\\s+([\\d\\.,]+)',
				};
			for( profileKey in profilePatterns ) {
				var regex = new RegExp( profilePatterns[profileKey] );
				var profileVar = regex.exec(profileDetails);
				if ( profileVar && profileVar.length == 2 ) {
					if ( 'fines' == profileKey
						|| 'bond' == profileKey
						|| 'bail' == profileKey )
						profileVar[1] = parseInt( profileVar[1].replace( /,/, '' ) );
					if ( 'arrest_date' == profileKey
						|| 'book_date' == profileKey
						|| 'scheduled_release_date' == profileKey )
						profileVar[1] = new Date( profileVar[1] ).getTime();
					inmateProfileData[profileKey] = profileVar[1];
				} else {
					inmateProfileData[profileKey] = false;
				}
			}

		}

		// Handle charges
		if ( $(this).find('td').eq(1).text() == 'Disposition' ) {
        	process_next = 'charge';
        	// inmateProfileData['charge'] = new Array();
			return;
        }
        if ( process_next == 'charge' ) {
        	var charge = new Object;
        	charge['offense'] = $(this).find('td').eq(0).text().trim();
        	charge['disposition'] = $(this).find('td').eq(1).text().trim();
        	charge['sentence'] = $(this).find('td').eq(2).text().trim();

        	if ( charge['offense'].length == 0 )
        		return;

        	// Disabled - table doesn't use in any useful way at the moment
        	// inmateProfileData['charge'].push( charge );
        }

	});
	return inmateProfileData;
}

exports.readAsJson = inmateScraper.readAsJson;
exports.refreshSrc = inmateScraper.refreshSrc;

if ( args[2] == 'refresh-src' )
	inmateScraper.refreshSrc();