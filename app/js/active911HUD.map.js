"use strict";
var Active911HUDMap;
(function ($) {
    Active911HUDMap = function (elem, apiKey, callback, mapOptions, alertSettings) {
        this.mapElem = $(elem);
        this.mapOptions = $.extend(this.mapOptions, mapOptions || {});
        this.alertSettings = $.extend({}, alertSettings || {});

        let script = document.createElement('script');
        script.src = "https://maps.googleapis.com/maps/api/js?callback=" + callback + "&key=" + apiKey;
        script.async = true;
        script.defer = true;
        document.getElementsByTagName('body')[0].appendChild(script);
    };

    Active911HUDMap.prototype = {
        activeAlertTimer: null,
        geocoder: null,
        mapElem: null,
        googleMap: null,
        mapOptions: {
            centerAddress: '1600 Pennsylvania Ave Washington D.C. 20202',
            center: { lat: 38.89768, lng: -77.038671 },
            zoom: 12
        },

        clearRoute: function () {
            this.directionsRenderer.setDirections({routes: []});
            this.googleMap.setOptions(this.mapOptions);
        },

        drawRoute: function (destination) {
            destination = new google.maps.LatLng(destination.lat, destination.lng);
            let directionReq = {
                origin: this.mapOptions.center,
                destination: destination,
                travelMode: google.maps.TravelMode.DRIVING,
                provideRouteAlternatives: false
            };
            var that = this;
            let directions = new google.maps.DirectionsService();
            directions.route(directionReq, function (result, status) {
                if (status === google.maps.DirectionsStatus.OK) {
                    that.directionsRenderer.setDirections(result);
                    that.stopActiveAlertTimer();
                    that.startActiveAlertTimer();
                }
                else {
                    console.error(status);
                }
            });
        },

        initialize: function () {
            this.googleMap = new google.maps.Map($(this.mapElem)[0], this.mapOptions);
            this.geocoder = new google.maps.Geocoder();
            this.directionsRenderer = new google.maps.DirectionsRenderer();
            this.directionsRenderer.setMap(this.googleMap);

            this.homeMarker = new google.maps.Marker({
                position: this.mapOptions.center,
                map: this.googleMap
            });
        },

        startActiveAlertTimer: function () {
            this.activeAlertTimer = setTimeout(
                $.proxy(this.clearRoute, this),
                this.alertSettings.activeAlertAge
            );
        },

        stopActiveAlertTimer: function () {
            if (this.activeAlertTimer !== null) {
                clearTimeout(this.activeAlertTimer);
                this.activeAlertTimer = null;
            }
        },

        updateHomeMarker: function (config) {
            this.homeMarker.setOptions(config);
        },

        updateOptions: function (options) {
            this.mapOptions = $.extend(this.mapOptions, options);
            this.googleMap.setOptions(this.mapOptions);
        }
    };
})(jQuery);