"use strict";

let active911Map, active911SettingsModel;

$('#active911\\:exit').on('click', (e) => {
    e.stopPropagation();
    ipcRenderer.send('exit-application');
});
$('#active911\\:open-settings').on('click', (e) => {
    e.stopPropagation();
    $('#active911\\:settings-overlay').fadeIn();
    $('#active911\\:settings').addClass('open');
});
$('#active911\\:close-settings').on('click', (e) => {
    e.stopPropagation();
    $('#active911\\:settings').removeClass('open');
    $('#active911\\:settings-overlay').fadeOut();
});
$('#active911\\:google-maps\\:lookup-location').on('click', (e) => {
    e.stopPropagation();
    $('#active911\\:geocoding').show();
    active911Map.geocoder.geocode({ address: $('#active911\\:googleMaps\\:geocode').val() }, (results, status) => {
        if (status === 'OK') {
            active911SettingsModel.googleMaps.center.lat(results[0].geometry.location.lat());
            active911SettingsModel.googleMaps.center.lng(results[0].geometry.location.lng());
            $('#active911\\:geocoding').hide();
        }
        else {
            alert('Failed to geocode address: ' + status);
        }
    });
    return false;
});
$('#active911\\:settings-save').on('click', saveSettings);
$('#active911\\:save-settings').on('click', saveSettings);

function clearActiveAlert() {
    "use strict";
    $('#active911-hud > .navbar.sticky-top').removeClass('bg-active-alert');
    $('#active911\\:active-alert-container').html(null);
}

function googleMapInitializeCallback() {
    active911Map.initialize();
}

function saveSettings(e) {
    "use strict";
    e.stopPropagation();
    let settings = ko.mapping.toJS(active911SettingsModel);
    settings.googleMaps.zoom = parseInt(settings.googleMaps.zoom);
    settings.active911.clearOldAlerts = Boolean(settings.active911.clearOldAlerts).valueOf();
    active911Settings.setGoogleMapsApiKey(settings.googleMapsApiKey)
        .set('googleMaps', settings.googleMaps)
        .set('active911', settings.active911);
    active911Settings.save();

    active911Map.updateOptions(settings.googleMaps);
    $('#active911\\:close-settings').click();

    return false;
}

/**
 * An active alert has been detected, show it above all others
 */
function showActiveAlert() {
    "use strict";
    let address = '',
        alert = $('#active911\\:active-alert-template > [role="alert"]').clone();

    alert.attr('id', 'active-alert-' + active911.activeAlert.id);

    $('.location-name', alert).text('#' + active911.activeAlert.cad_code + ' ' + active911.activeAlert.description); // active911.activeAlert.address);

    if (active911.activeAlert.place) address += active911.activeAlert.place + "\n";
    address += active911.activeAlert.address;
    if (active911.activeAlert.unit) address += " " + active911.activeAlert.unit;
    address += "\n" + active911.activeAlert.city + ", " + active911.activeAlert.state;

    $('address', alert).text(address);

    $('.description', alert).text(active911.activeAlert.description);

    $('.alert-time', alert).text(
        "Received: " + active911.activeAlert.received.toLocaleDateString(
            "en-US",
            {month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'}
        )
    );

    $('#active911-hud > .navbar.sticky-top').addClass('bg-active-alert');
    $('#active911\\:active-alert-container').html(alert);
}

/**
 * Update alert in normal alert listing
 *
 * @param data Alert object
 */
function updateAlert(data) {
    let alert,
        existing = true,
        template = $('#active911\\:alert-list-template > [role="list"]').clone(),
        address = '',
        dateSent;

    alert = $('#alert-' + data.id);
    if (alert.length === 0) {
        existing = false;
        alert = template;
        alert.attr('id', 'alert-' + data.id);
    }

    $('.location-name', alert).text('#' + data.cad_code + ' ' + data.address);

    if (data.place) address += data.place + "\n";
    address += data.address;
    if (data.unit) address += " " + data.unit;
    address += "\n" + data.city + ", " + data.state;
    $('address', alert).text(address);

    $('.description', alert).text(data.description);

    $('.timestamp', alert).text(
        data.received.toLocaleDateString(
            "en-US",
            {month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'}
        )
    );

    if (!existing) alert.appendTo('#active911\\:alerts');
}

function updateGoogleRoute(incident) {
    if (typeof incident === "undefined" || incident === null) {
        active911Map.updateHomeMarker({
            lat: active911.getAgency().latitude,
            lng: active911.getAgency().longitude,
            visible: false
        });
    }
    else {
        let destination;
        if (parseFloat(incident.latitude) && parseFloat(incident.longitude)) {
            destination = { lat: incident.latitude, lng: incident.longitude };
            active911Map.drawRoute(destination);
        }
        else {
            destination = incident.address + ' ' + incident.city + ' ' + incident.state;

            active911Map.geocodeAddress(destination).then((result) => {
                console.log(result);
                if (result.length > 0 && result[0].geometry && result[0].geometry.location) {
                    active911Map.drawRoute(result[0].geometry.location);
                }
            });
        }
    }
}

function updateTimer() {
    let date = new Date();
    $('#current-time').html(
        sprintf('%2d:%02d:%02d', date.getHours(), date.getMinutes(), date.getSeconds())
    );
    setTimeout(updateTimer, 250);
}

ipcRenderer.on('alerts-updated', () => {
    $('#active911\\:last-updated').html(new Date().toLocaleDateString(
        "en-US",
        {month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'}
    ));

    $(active911.alerts).each((i, alert) => {
        updateAlert(alert);
    });

    active911.setActiveAlert();

    /* Test for intersection routing: */
    // active911.activeAlert = {"id":"114859145","received":"2018-02-05T02:12:08.000Z","sent":"2018-02-05T02:12:12.000Z","priority":"2","description":"VEHICLE COLLISION","details":"00:02:30 new units: M149 E141 DTY14\n\nNARRATIVE: SAW SMALL CAR SLIDE OFF ROAD AND HIT TREES/SPUN OUT/ON BRADDOCK RI        GHT AT SKIDMORE/UNK INJ\nFIREBOXINFO: 14 01 HC04 12 HC13 10 FC17 03 MC13 13 HC03 FC15 FC25 08 FC16 BC46 09 MC17 FC33 FC09 06 FC23 MC09 BC56 FC11 FC24 05 MC35 BC18 02 04 BC03 HC05 BC31 HC08 FC02 FC13 BC02 BC19 FC50 SFM 99\nCALLER_NAME: cody parks","external_data":"","place":"","address":"BRADDOCK RD / SKIDMORE RD","unit":"","cross_street":"FLEMING RD                   SKIDMORE RD","city":"MT AIRY","state":"MD","latitude":"0.00000000","longitude":"0.00000000","source":"","units":"M149 E141","cad_code":"18002271","map_code":"1417","agency":{"id":"22844","uri":"https://access.active911.com/interface/open_api/api/agencies/22844"},"pagegroups":[{"title":"Fire: E141 E142 TT14 B145 FR14 CS14 U14","prefix":"TE"},{"title":"EMS: M149 FR14 I149 A149 U14 U14-1","prefix":"BH"}],"responses":[{"response":"watch","timestamp":"2018-02-05 02:12:11","device":{"id":"506098","uri":"https://access.active911.com/interface/open_api/api/devices/506098"}},{"response":"watch","timestamp":"2018-02-05 02:12:16","device":{"id":"419626","uri":"https://access.active911.com/interface/open_api/api/devices/419626"}},{"response":"watch","timestamp":"2018-02-05 02:12:21","device":{"id":"486462","uri":"https://access.active911.com/interface/open_api/api/devices/486462"}},{"response":"watch","timestamp":"2018-02-05 02:12:25","device":{"id":"520295","uri":"https://access.active911.com/interface/open_api/api/devices/520295"}},{"response":"watch","timestamp":"2018-02-05 02:12:34","device":{"id":"506109","uri":"https://access.active911.com/interface/open_api/api/devices/506109"}},{"response":"watch","timestamp":"2018-02-05 02:12:41","device":{"id":"412607","uri":"https://access.active911.com/interface/open_api/api/devices/412607"}},{"response":"watch","timestamp":"2018-02-05 02:12:54","device":{"id":"508602","uri":"https://access.active911.com/interface/open_api/api/devices/508602"}},{"response":"watch","timestamp":"2018-02-05 02:13:00","device":{"id":"157251","uri":"https://access.active911.com/interface/open_api/api/devices/157251"}},{"response":"watch","timestamp":"2018-02-05 02:13:09","device":{"id":"514670","uri":"https://access.active911.com/interface/open_api/api/devices/514670"}},{"response":"watch","timestamp":"2018-02-05 02:14:03","device":{"id":"508599","uri":"https://access.active911.com/interface/open_api/api/devices/508599"}},{"response":"watch","timestamp":"2018-02-05 02:15:04","device":{"id":"508605","uri":"https://access.active911.com/interface/open_api/api/devices/508605"}},{"response":"watch","timestamp":"2018-02-05 02:16:54","device":{"id":"419052","uri":"https://access.active911.com/interface/open_api/api/devices/419052"}},{"response":"watch","timestamp":"2018-02-05 02:53:02","device":{"id":"509639","uri":"https://access.active911.com/interface/open_api/api/devices/509639"}},{"response":"watch","timestamp":"2018-02-05 03:01:16","device":{"id":"419050","uri":"https://access.active911.com/interface/open_api/api/devices/419050"}}]};
    // active911.activeAlert = {"id":"115025578","received":"2018-02-06T16:58:14.000Z","sent":"2018-02-06T16:58:16.000Z","priority":"4","description":"WIRES DOWN","details":"\nNARRATIVE: BRANCH ON FIRE ON TOP OF WIRES\nFIREBOXINFO: 14 12 HC13 HC04 HC03 13 01 BC46 10 03 BC56 BC18 09 HC08 FC17 BC31 BC19 BC41 MC13 BC03 BC40 HC05 BC02 MC17 08 HC02 BC32 06 BC85 FC16 FC15 FC25 02 04 FC09 BC04 HC09 FC33 FC11 FC24 SFM 99\nCALLER_NAME: carol","external_data":"","place":"","address":"OLD WASHINGTON RD / PINEY VIEW CT","unit":"","cross_street":"W OLD LIBERTY RD             W OBRECHT RD","city":"SYKESVILLE","state":"MD","latitude":"0.00000000","longitude":"0.00000000","source":"","units":"E141","cad_code":"18002374","map_code":"1409","agency":{"id":"22844","uri":"https://access.active911.com/interface/open_api/api/agencies/22844"},"pagegroups":[{"title":"Fire: E141 E142 TT14 B145 FR14 CS14 U14","prefix":"TE"}],"responses":[{"response":"watch","timestamp":"2018-02-06 16:58:16","device":{"id":"506098","uri":"https://access.active911.com/interface/open_api/api/devices/506098"}},{"response":"watch","timestamp":"2018-02-06 16:58:33","device":{"id":"520295","uri":"https://access.active911.com/interface/open_api/api/devices/520295"}},{"response":"watch","timestamp":"2018-02-06 16:58:36","device":{"id":"419052","uri":"https://access.active911.com/interface/open_api/api/devices/419052"}},{"response":"watch","timestamp":"2018-02-06 16:58:43","device":{"id":"412607","uri":"https://access.active911.com/interface/open_api/api/devices/412607"}},{"response":"watch","timestamp":"2018-02-06 16:58:44","device":{"id":"486462","uri":"https://access.active911.com/interface/open_api/api/devices/486462"}},{"response":"watch","timestamp":"2018-02-06 16:59:26","device":{"id":"509639","uri":"https://access.active911.com/interface/open_api/api/devices/509639"}},{"response":"watch","timestamp":"2018-02-06 17:01:18","device":{"id":"507410","uri":"https://access.active911.com/interface/open_api/api/devices/507410"}},{"response":"watch","timestamp":"2018-02-06 17:02:27","device":{"id":"419626","uri":"https://access.active911.com/interface/open_api/api/devices/419626"}},{"response":"watch","timestamp":"2018-02-06 17:16:06","device":{"id":"508602","uri":"https://access.active911.com/interface/open_api/api/devices/508602"}},{"response":"watch","timestamp":"2018-02-06 23:13:25","device":{"id":"157251","uri":"https://access.active911.com/interface/open_api/api/devices/157251"}}]};

    if (active911.activeAlert !== null) {
        $('#alert-' + active911.activeAlert.id).addClass('panel-primary');
        updateGoogleRoute(active911.activeAlert);
        showActiveAlert();
    }
});

ipcRenderer.on('agency-updated', () => {
    $('#active911\\:agency').html(active911.getAgency().name);

    active911Map.updateHomeMarker({
        lat: active911.getAgency().latitude,
        lng: active911.getAgency().longitude,
        visible: true
    });
});

$(document).ready(() => {
    active911.on('active-alert-timer-start', showActiveAlert);
    active911.on('active-alert-timer-stop', clearActiveAlert);

    $('#active911\\:googleMaps\\:zoom-value > span').text(active911Settings.config.googleMaps.zoom);
    $('#active911\\:googleMaps\\:zoom').slider('setValue', active911Settings.config.googleMaps.zoom);

    updateTimer();

    $('#active911\\:googleMaps\\:zoom').on('slide', function (slideEvt) {
        $('#active911\\:googleMaps\\:zoom-value > span').text(slideEvt.value);
    });

    $('#launch-google').on('click', function (e) {
        e.preventDefault();
        ipcRenderer.send('launch-google');
    });

    active911SettingsModel = ko.mapping.fromJS(active911Settings.config);
    ko.applyBindings(active911SettingsModel);

    $('#active911\\:settings').dependentFields();

    if (active911Settings.getGoogleMapsApiKey()) {
        active911Map = new Active911HUDMap(
            active911,
            $('#active911\\:map'),
            active911Settings.getGoogleMapsApiKey(),
            "googleMapInitializeCallback",
            active911Settings.config.googleMaps,
            active911Settings.config.active911.alerts
        );
    }

    active911.startup();
});