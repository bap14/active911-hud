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
        homeMarker: null,
        mapElem: null,
        googleMap: null,
        mapOptions: {
            centerAddress: '1600 Pennsylvania Ave Washington D.C. 20202',
            center: { lat: 38.89768, lng: -77.038671 },
            zoom: 12
        },

        clearHomeMarker: function () {
            if (this.homeMarker instanceof google.maps.Marker) {
                this.homeMarker.setMap(null);
            }
            return this;
        },

        clearRoute: function () {
            this.directionsRenderer.setDirections({routes: []});
            this.googleMap.setOptions(this.mapOptions);
        },

        drawRoute: function (destination) {
            if (typeof destination !== "object") {
                throw "Expecting LatLng or LatLngLiteral object";
            }

            if (!(destination instanceof google.maps.LatLng)) {
                if (!destination.lat || !destination.lng) {
                    throw "Destination object missing 'lat' or 'lng' definition";
                }

                destination = new google.maps.LatLng({
                    lat: parseFloat(destination.lat),
                    lng: parseFloat(destination.lng)
                });
            }

            this.clearHomeMarker();

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

        geocodeAddress: function (address) {
            return new Promise((resolve, reject) => {
                let geocoder = new google.maps.Geocoder();

                geocoder.geocode({ address: address }, (result, status) => {
                    if (status === google.maps.GeocoderStatus.OK) {
                        resolve(result);
                    } else {
                        reject(status);
                    }
                });
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
                this.alertSettings.activeAlertAge * (1000 * 60)
            );
        },

        stopActiveAlertTimer: function () {
            if (this.activeAlertTimer !== null) {
                clearTimeout(this.activeAlertTimer);
                this.activeAlertTimer = null;
            }
        },

        updateHomeMarker: function (config) {
            this.homeMarker.setMap(this.googleMap);
            this.homeMarker.setOptions(config);
        },

        updateOptions: function (options) {
            this.mapOptions = $.extend(this.mapOptions, options);
            this.googleMap.setOptions(this.mapOptions);
        }
    };
})(jQuery);