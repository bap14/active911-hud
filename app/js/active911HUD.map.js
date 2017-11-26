"use strict";
var Active911HUDMap;
(function ($) {
    Active911HUDMap = function (elem, apiKey, callback, mapOptions) {
        this.mapElem = $(elem);
        this.mapOptions = $.extend(this.mapOptions, mapOptions || {});

        let script = document.createElement('script');
        script.src = "https://maps.googleapis.com/maps/api/js?callback=" + callback + "&key=" + apiKey;
        script.async = true;
        script.defer = true;
        document.getElementsByTagName('body')[0].appendChild(script);
    };

    Active911HUDMap.prototype = {
        geocoder: null,
        mapElem: null,
        googleMap: null,
        mapOptions: {
            centerAddress: '1600 Pennsylvania Ave Washington D.C. 20202',
            center: { lat: 38.89768, lng: -77.038671 },
            zoom: 12
        },

        clearRoute: function () {
        },

        drawRoute: function (destination) {
        },

        initialize: function () {
            this.googleMap = new google.maps.Map($(this.mapElem)[0], this.mapOptions);
            this.geocoder = new google.maps.Geocoder();

            this.homeMarker = new google.maps.Marker({
                position: this.mapOptions.center,
                map: this.googleMap,
                visible: false
            });
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