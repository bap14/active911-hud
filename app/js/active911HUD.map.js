"use strict";
var Active911HUDMap;
(function ($) {
    Active911HUDMap = function (active911, elem, apiKey, callback, mapOptions, alertSettings) {
        this.active911 = active911;
        this.mapElem = $(elem);
        this.mapOptions = $.extend(this.mapOptions, mapOptions || {});
        this.alertSettings = $.extend({}, alertSettings || {});

        this.addGoogleMapsApi(apiKey, callback);
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

        addGoogleMapsApi: function (apiKey, callback) {
            if ($('#google-maps-api-src')) {
                $('#google-maps-api-src').remove();
            }

            let script = document.createElement('script');
            script.src = "https://maps.googleapis.com/maps/api/js?key=" + apiKey;
            if (callback) {
                script.src += "&callback=" + callback
            }
            script.id = 'google-maps-api-src';
            script.async = true;
            script.defer = true;
            document.getElementsByTagName('body')[0].appendChild(script);
        },

        clearHomeMarker: function () {
            if (this.homeMarker.__proto__ === google.maps.Marker.prototype) {
                this.homeMarker.setMap(null);
            }
            return this;
        },

        clearRoute: function () {
            this.directionsRenderer.setDirections({routes: []});
            this.googleMap.setOptions(this.mapOptions);
            this.showHomeMarker();
        },

        drawRoute: function (destination) {
            if (typeof destination !== "object") {
                throw "Expecting LatLng or LatLngLiteral object";
            }

            if (!(destination.__proto__ === google.maps.LatLng.prototype)) {
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
            var self = this;
            let directions = new google.maps.DirectionsService(), preserveViewport=false;
            directions.route(directionReq, function (result, status) {
                if (status === google.maps.DirectionsStatus.OK) {
                    if (result.routes[0].legs[0].distance.value <= 1600) preserveViewport = true;

                    self.directionsRenderer.setOptions({ preserveViewport: preserveViewport });
                    self.directionsRenderer.setDirections(result);
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
                position: this.mapOptions.home,
                map: this.googleMap,
                icon: {
                    url: path.dirname(path.dirname(require.main.filename)) + "/images/marker-home.png"
                }
            });

            this.active911.on('active-alert-timer-stop', this.clearRoute.bind(this));
        },

        showHomeMarker: function () {
            if (typeof this.homeMarker !== "undefined" && this.homeMarker.__proto__ === google.maps.Marker.prototype) {
                this.homeMarker.setVisible(true);
                this.homeMarker.setMap(this.googleMap);
            }
        },

        updateHomeMarker: function (config, showMarker) {
            if (typeof showMarker === "undefined") {
                showMarker = false;
            }

            if (typeof config === "object") {
                if (config.hasOwnProperty('lat') && config.hasOwnProperty('lng')) {
                    this.homeMarker.setPosition(new google.maps.LatLng(config.lat, config.lng));
                }

                if (config.hasOwnProperty('visible')) {
                    this.homeMarker.setVisible(config.visible);
                }
            }

            if (showMarker) {
                this.showHomeMarker();
            }
        },

        updateOptions: function (options) {
            this.mapOptions = $.extend(this.mapOptions, options);
            this.googleMap.setOptions(this.mapOptions);
        }
    };
})(jQuery);