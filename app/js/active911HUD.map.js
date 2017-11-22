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
        mapElem: null,
        googleMap: null,
        mapOptions: {
            center: {lat: -34.397, lng: 150.644},
            zoom: 8
        },

        initialize: function () {
            this.googleMap = new google.maps.Map($(this.mapElem)[0], this.mapOptions);
        }
    };
})(jQuery);