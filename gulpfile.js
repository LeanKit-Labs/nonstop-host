var gulp = require( "gulp" );
require( "biggulp/common-gulp" )( gulp );

gulp.task( "default", [ "coverage", "coverage-watch" ] );
