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
            center: {lat: 38.89768, lng: -77.038671},
            zoom: 12
        },

        initialize: function () {
            this.googleMap = new google.maps.Map($(this.mapElem)[0], this.mapOptions);
            this.geocoder = new google.maps.Geocoder();
        },

        getGoogleMap: function () {
            return this.googleMap;
        }
    };
})(jQuery);