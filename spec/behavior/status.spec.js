require( "../setup" );

describe( "Status", function() {
	var status = require( "../../src/status" );
	describe( "uptime", function() {
		describe( "before the service is started", function() {
			var uptime;
			before( function() {
				status.resetTimers();
				uptime = status.uptime;
			} );

			it( "should report 0 seconds of host uptime", function() {
				uptime.should.eql( "0 seconds" );
			} );

			it( "should report 0 seconds of service uptime", function() {
				status.serviceUptime.should.eql( "0 seconds" );
			} );
		} );

		describe( "after the service is started", function() {
			before( function( done ) {
				status.recordStart( {} );
				setTimeout( function() {
					done();
				}, 10 );
			} );

			it( "should not report 0 seconds of host uptime", function() {
				status.uptime.should.not.eql( "0 seconds" );
			} );

			it( "should report less than a second of service uptime", function() {
				status.serviceUptime.should.eql( "less than a second" );
			} );

			after( function() {
				status.resetTimers();
			} );
		} );
	} );

	describe( "lastEvent", function() {
		describe( "before any events are recorded", function() {
			before( function() {
				// ensures that setting last event to undefined
				// does not record a time stamp
				status.lastEvent = undefined;
			} );
			it( "should report 'N/A' since no events have occurred", function() {
				status.timeSinceLastEvent.should.eql( "N/A" );
			} );
		} );

		describe( "after an event is recorded", function() {
			before( function( done ) {
				status.lastEvent = { test: "it's what's for dinner" };
				setTimeout( function() {
					done();
				}, 10 );
			} );

			it( "should report less than a second since last event", function() {
				status.timeSinceLastEvent.should.eql( "less than a second" );
			} );

			it( "should capture lastEvent correctly", function() {
				status.lastEvent.should.eql( { test: "it's what's for dinner" } );
			} );

			after( function() {
				status.resetTimers();
				status.lastEvent = undefined;
			} );
		} );
	} );

	describe( "activity", function() {
		describe( "before any activity is recorded", function() {
			before( function() {
				// ensures that setting activity to undefined
				// does not record a time stamp
				status.activity = undefined;
			} );
			it( "should report 'N/A' since no events have occurred", function() {
				status.timeSinceLastActivity.should.eql( "N/A" );
			} );
		} );

		describe( "after an activity is recorded", function() {
			before( function( done ) {
				status.activity = { test: "IT'S GOOD FOR YOU" };
				setTimeout( function() {
					done();
				}, 10 );
			} );

			it( "should report less than a second since activity", function() {
				status.timeSinceLastActivity.should.eql( "less than a second" );
			} );

			it( "should capture activity correctly", function() {
				status.activity.should.eql( { test: "IT'S GOOD FOR YOU" } );
			} );

			after( function() {
				status.resetTimers();
				status.activity = undefined;
			} );
		} );
	} );

	describe( "check", function() {
		describe( "before any check takes place", function() {
			it( "should not have a lastCheck property", function() {
				should.not.exist( status.lastCheck );
			} );
		} );

		describe( "after a passing check is recorded", function() {
			before( function() {
				status.recordLastCheck();
			} );

			it( "should have a timestamp for a successful check", function() {
				status.lastCheck.successOn.should.be.ok;
			} );

			it( "should not have a failed timestamp", function() {
				should.not.exist( status.lastCheck.failedOn );
			} );

			after( function() {
				status.resetTimers();
			} );
		} );

		describe( "after a passing check is recorded", function() {
			before( function() {
				status.recordFailedCheck();
			} );

			it( "should have a timestamp for a failed check", function() {
				status.lastCheck.failedOn.should.be.ok;
			} );

			it( "should not have a success timestamp", function() {
				should.not.exist( status.lastCheck.successOn );
			} );

			after( function() {
				status.resetTimers();
			} );
		} );

		describe( "after passing and failing checks", function() {
			before( function() {
				status.recordLastCheck();
				status.recordFailedCheck();
			} );

			it( "should have a timestamp for a failed check", function() {
				status.lastCheck.failedOn.should.be.ok;
			} );

			it( "should have a timestamp for a successful check", function() {
				status.lastCheck.successOn.should.be.ok;
			} );

			after( function() {
				status.resetTimers();
			} );
		} );
	} );

	describe( "Updating status", function() {
		describe( "without collisions", function() {
			before( function() {
				status.update( { test: { a: 1, b: [ 2 ], c: { value: 3 } } } );
			} );

			it( "should set status's test property", function() {
				status.test.should.eql( { a: 1, b: [ 2 ], c: { value: 3 } } );
			} );

			after( function() {
				status.test = undefined;
			} );
		} );

		describe( "with collisions", function() {
			before( function() {
				status.test = { b: [ 2 ], d: 4 };
				status.update( { test: { a: 1, c: { value: 3 }, d: { title: "four" } } } );
			} );

			it( "should merge status's test property with update values", function() {
				status.test.should.eql( { a: 1, b: [ 2 ], c: { value: 3 }, d: { title: "four" } } );
			} );

			after( function() {
				status.test = undefined;
			} );
		} );
	} );
} );
