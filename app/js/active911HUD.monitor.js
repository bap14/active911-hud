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
$('#active911\\:settings-save').on('click', (e) => {
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
});

function clearActiveAlert() {
    "use strict";
    $('#active911-hud > .navbar.sticky-top').removeClass('bg-active-alert');
    $('#active911\\:active-alert-container').html();
}

function googleMapInitializeCallback() {
    active911Map.initialize();
}

/**
 * An active alert has been detected, show it above all others
 */
function showActiveAlert() {
    "use strict";
    let address = '',
        alert = $('#active911\\:active-alert-template > [role="alert"]').clone();

    alert.attr('id', 'active-alert-' + active911.activeAlert.id);

    $('.location-name', alert).text('#' + active911.activeAlert.cad_code + ' ' + active911.activeAlert.address);

    if (active911.activeAlert.place) address += active911.activeAlert.place + "\n";
    address += active911.activeAlert.address;
    if (active911.activeAlert.unit) address += " " + active911.activeAlert.unit;
    address += "\n" + active911.activeAlert.city + ", " + active911.activeAlert.state;

    $('address', alert).text(address);

    $('.description', alert).text(active911.activeAlert.description);

    $('.timestamp', alert).text(active911.activeAlert.received);

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

    $('.timestamp', alert).text(data.received);

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
        if (incident.latitude && incident.longitude) {
            destination = { lat: incident.latitude, lng: incident.longitude };
            active911Map.drawRoute(destination);
        }
        else {
            destination = incident.address + ' ' + incident.city + ' ' + incident.state;

            active911Map.geocodeAddress(destination).then((result) => {
                active911Map.drawRoute(result.geometry.location);
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
    $(active911.alerts).each((i, alert) => {
        updateAlert(alert);
    });

    active911.setActiveAlert();

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