"use strict";

const app = require('electron');
const path = require('path');

let active911Map, active911ResponseVocabularyModel, active911SettingsModel, mapMarkers = {}, mapInfoWindows = {};

$('#active911\\:exit').on('click', (e) => {
    e.stopPropagation();
    ipcRenderer.send('exit-application');
});
$('#active911\\:reauthorize').on('click', (e) => {
    e.stopPropagation();

    active911.stopUpdatingAlerts();
    active911.stopUpdatingDevices();
    active911.stopActiveAlertTimer();

    active911Settings.setOauthToken(false).save();
    ipcRenderer.send('restart-app');
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

function addPersonnelToLists(incident) {
    // Hide all response vocabulary terms
    for (let n=0; n < active911SettingsModel.active911.responseVocabulary().length; n++) {
        active911SettingsModel.active911.responseVocabulary()[n].hasRespondingPersonnel(false);
    }

    for (let i=0; i < incident.responses.length; i++) {
        let device = active911.getDevice(incident.responses[i].device.id),
            elemId,
            liElem,
            listId,
            visibleResponseType,
            vocabulary;

        if (typeof device !== "undefined" && typeof device.id !== "undefined") {
            visibleResponseType = ko.unwrap(
                active911SettingsModel.active911.responseVocabulary.vocabularyExists(
                    incident.responses[i].response,
                    'term'
                )
            );

            if (
                (
                    incident.responses[i].response.toLowerCase() === "watch" &&
                    active911SettingsModel.active911.showWatchers === true
                )
                || visibleResponseType === true
            ) {
                vocabulary = active911SettingsModel.active911.responseVocabulary.retrieve(
                    incident.responses[i].response,
                    'term'
                );
                if (typeof vocabulary === "undefined") {
                    console.error('Failed to load vocabulary term "' + incident.responses[i].response + '"');
                    return;
                }

                elemId = 'device-' + device.id();

                if ($('#' + elemId)) {
                    $('#' + elemId).remove();
                }

                liElem = document.createElement('li');
                listId = '#active911\\:response-type\\:' + vocabulary.id();

                $(liElem).attr('id', 'device-' + device.id())
                    .addClass('list-group-item')
                    .addClass('device')
                    .html('<h4>' + device.name() + '</h4>');
                vocabulary.hasRespondingPersonnel(true);

                $(listId).find('.card-body .personnel').append(liElem);
            }
        }
    }
}

function clearActiveAlert() {
    $('#active911-hud > .navbar.sticky-top').removeClass('bg-active-alert');
    $('#active911\\:active-alert-container').hide();
    $('#active911\\:active-alert-container').html('');
}

function clearPersonnelMarker(device) {
    if (typeof device.mapMarker === "object" && device.mapMarker.__proto__ === google.maps.Marker.prototype) {
        device.mapMarker.setMap(null);
        console.log(device.mapMarker);
    }
}

function clearPersonnelMarkers() {
    for (i=0; i < active911.devices.length; i++) {
        clearPersonnelMarker(active911.devices[i]);
    }
}

function googleMapInitializeCallback() {
    active911Map.initialize();
}

function initGoogleMap() {
    let retval = false;
    if (active911Settings.getGoogleMapsApiKey()) {
        active911Map = new Active911HUDMap(
            active911,
            $('#active911\\:map'),
            active911Settings.getGoogleMapsApiKey(),
            "googleMapInitializeCallback",
            active911Settings.config.googleMaps,
            active911Settings.config.active911.alerts
        );
        retval = true;
    }
    return retval;
}

function saveSettings(e) {
    e.stopPropagation();
    writeSettings();
    active911Map.updateOptions(active911Settings.get('googleMaps'));
    $('#active911\\:close-settings').click();
}

/**
 * An active alert has been detected, show it above all others
 */
function showActiveAlert() {
    "use strict";
    let activeAlert = active911.getActiveAlert(),
        address = '',
        alert = $('#active911\\:active-alert-template > [role="alert"]').clone();

    alert.attr('id', 'active-alert-' + activeAlert.id);

    $('.location-name', alert).text('#' + activeAlert.cad_code + ' ' + activeAlert.description); // activeAlert.address);

    if (activeAlert.place) address += activeAlert.place + "\n";
    address += activeAlert.address;
    if (activeAlert.unit) address += " " + activeAlert.unit;
    address += "\n" + activeAlert.city + ", " + activeAlert.state;

    $('address', alert).text(address);

    $('.description', alert).text(activeAlert.description);
    $('.units-alerted', alert).text(activeAlert.units);

    $('.alert-time', alert).text(
        "Received: " + activeAlert.received.toLocaleDateString(
            "en-US",
            {month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'}
        )
    );

    // Clear out responding personnel lists
    $('.respondingPersonnel .card-body .personnel .list-group-item').remove();

    showPersonnelMarkers(activeAlert);
    addPersonnelToLists(activeAlert);

    $('#active911-hud > .navbar.sticky-top').addClass('bg-active-alert');
    $('#active911\\:active-alert-container').html(alert);
    $('#active911\\:active-alert-container').show();
}

function showPersonnelMarkers(incident) {
    let visibleDevices = [];
    for (let n=0; n < active911.devices.length; n++) {
        let device = active911.getDevice(active911.devices[i].id());
        if (typeof device.mapMarker === "object" && device.mapMarker.__proto__ === google.maps.Marker.prototype) {
            visibleDevices.push(device.id());
        }
    }

    for (let i=0; i < incident.responses.length; i++) {
        let device = active911.getDevice(incident.responses[i].device.id),
            visibleResponseType;
        if (typeof device !== "undefined" && typeof device.id === "function") {
            visibleResponseType = ko.unwrap(
                active911SettingsModel.active911.responseVocabulary.vocabularyExists(
                    incident.responses[i].response,
                    'term'
                )
            );
            if (
                (
                    incident.responses[i].response.toLowerCase() === "watch" &&
                    ko.unwrap(active911SettingsModel.active911.showWatchers) === true
                )
                || visibleResponseType === true
            ) {
                let existingIndex = visibleDevices.indexOf(device.id());
                if (existingIndex >= 0) {
                    visibleDevices = visibleDevices.slice(existingIndex);
                }
                updatePersonnelMarker(device, incident.responses[i]);
            }
        }
    }

    for (let i=0; i < visibleDevices.length; i++) {
        clearPersonnelMarker(active911.getDevice(visibleDevices[i]));
    }

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
        address = '';

    alert = $('#alert-' + data.id);
    if (alert.length === 0) {
        existing = false;
        alert = template;
        alert.attr('id', 'alert-' + data.id);
    }

    $('.alert-title > .number', alert).text(data.cad_code);
    $('.alert-title > .description', alert).text(data.description);

    if (data.place) address += data.place + "\n";
    address += data.address;
    if (data.unit) address += " " + data.unit;
    address += "\n" + data.city + ", " + data.state;

    $('.alert-description', alert).text(address);

    $('.alert-date', alert).text(
        data.received.toLocaleDateString(
            "en-US",
            {month: '2-digit', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'}
        )
    );

    if (!existing) alert.appendTo('#active911\\:alert-list');
}

function updateGoogleRoute(incident) {
    if (typeof incident === "undefined" || incident === null) {
        active911Map.updateHomeMarker({
            lat: active911.getAgency().latitude,
            lng: active911.getAgency().longitude,
            visible: true
        });

        clearPersonnelMarkers();
    }
    else {
        let destination;
        if (parseFloat(incident.latitude) && parseFloat(incident.longitude)) {
            destination = { lat: parseFloat(incident.latitude), lng: parseFloat(incident.longitude) };
            active911Map.drawRoute(destination);
        }
        else {
            destination = incident.address + ' ' + incident.city + ' ' + incident.state;

            active911Map.geocodeAddress(destination).then((result) => {
                if (result.length > 0 && result[0].geometry && result[0].geometry.location) {
                    active911Map.drawRoute(result[0].geometry.location);
                }
            });
        }
        showPersonnelMarkers(incident);
    }
}

function updatePersonnelMarker(device, response) {
    active911.cacheDevice(device.id()).then(() => {
        let deviceContent = '<h4 class="text-center">' + device.name() + '</h4>'
                + '<p class="text-center"><small>'
                + active911SettingsModel.active911.responseVocabulary.retrieve(response.response, 'term').label()
                + '</small></p>';

        if (
            !mapMarkers.hasOwnProperty(device.id()) ||
            mapMarkers[device.id()].__proto__ !== google.maps.Marker.prototype
        ) {
            mapMarkers[device.id()] = new google.maps.Marker({
                map: active911Map.googleMap,
                icon: {url: path.dirname(path.dirname(require.main.filename)) + "/images/marker-personnel.png"},
                position: new google.maps.LatLng({ lat: device.latitude(), lng: device.longitude() })
            });
        } else {
            mapMarkers[device.id()].setMap(active911Map.googleMap);
            mapMarkers[device.id()].setOptions({
                position: { lat: device.latitude(), lng: device.longitude() }
            });
        }

        if (
            !mapInfoWindows.hasOwnProperty(device.id()) ||
            mapInfoWindows[device.id()].__proto__ !== google.maps.InfoWindow.prototype
        ) {
            mapInfoWindows[device.id()] = new google.maps.InfoWindow({
                disableAutoPan: active911SettingsModel.panToShowAllMarkers(),
                content: deviceContent
            });
        } else {
            mapInfoWindows[device.id()].setContent(deviceContent);
        }
        mapInfoWindows[device.id()].open(active911Map.googleMap, mapMarkers[device.id()]);
    }).catch((err) => {
        console.error(err);
    });
}

function updateTimer() {
    let date = new Date();
    $('#current-time').html(
        sprintf('%2d:%02d:%02d', date.getHours(), date.getMinutes(), date.getSeconds())
    );
    setTimeout(updateTimer, 250);
}

function writeSettings() {
    let settings = ko.mapping.toJS(active911SettingsModel);
    settings.googleMaps.zoom = parseInt(settings.googleMaps.zoom);
    settings.active911.clearOldAlerts = Boolean(settings.active911.clearOldAlerts).valueOf();
    settings.active911.showWatchers = active911SettingsModel.toggleIncludeWatchers();
    settings.mapOptions.panToShowAllMarkers = active911SettingsModel.panToShowAllMarkers();
    active911Settings.setGoogleMapsApiKey(settings.googleMapsApiKey)
        .set('googleMaps', settings.googleMaps)
        .set('active911', settings.active911);
    active911Settings.save();
}

function VocabularyWord(term, label, order, id) {
    let self = this, itemOrder;

    if (typeof id === "undefined" || id === null || !/^[a-z0-9]{4}(?:-[a-z0-9]{4}){3}$/i.test(id)) {
        id = self.generateRandomId();
    }

    if (typeof order === "undefined" || order === -1) {
        itemOrder = self.getNewOrder();
    } else {
        itemOrder = parseInt(order);
    }

    self.id = ko.observable(id);
    self.term = ko.observable(term);
    self.label = ko.observable(label);
    self.order = ko.observable(itemOrder);
    self.hasRespondingPersonnel = ko.observable(false);
}

VocabularyWord.prototype.generateRandomId = function () {
    let id = "";

    let characters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

    for (let i=0; i<4; i++) {
        for (let n=0; n<4; n++) {
            id += characters.charAt(Math.random() * (characters.length - 1));
        }
        id += '-';
    }
    id = id.substr(0, id.length - 1);

    return id;
};

VocabularyWord.prototype.getNewOrder = function () {
    let i=0, maxOrder = -1, currentVocabulary;

    for (i; i<active911SettingsModel.active911.responseVocabulary().length; i++) {
        currentVocabulary = active911SettingsModel.active911.responseVocabulary()[i];
        if (typeof currentVocabulary.order !== "undefined" && maxOrder === -1) {
            maxOrder = ko.unwrap(currentVocabulary.order);
            continue;
        }

        if (typeof currentVocabulary.order !== "undefined" && ko.unwrap(currentVocabulary.order) > maxOrder) {
            maxOrder = ko.unwrap(currentVocabulary.order);
        }
    }

    return maxOrder + 1;
};

active911.on('new-alert', () => {
    updateGoogleRoute(active911.getActiveAlert());
    showActiveAlert();
});

active911.on('updating-alerts-start', () => {
    $('#active911\\:updating-alerts').show();
});

active911.on('updating-alerts-end', () => {
    $('#active911\\:updating-alerts').hide();
});

active911.on('alerts-updated', () => {
    $('#active911\\:last-updated').html(new Date().toLocaleDateString(
        "en-US",
        {month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit'}
    ));

    $(active911.alerts).each((i, alert) => {
        updateAlert(alert);
    });
    if (active911.getActiveAlert()) {
        showPersonnelMarkers(active911.getActiveAlert());
        addPersonnelToLists(active911.getActiveAlert());
    }
});

ipcRenderer.on('oauth-update-complete', () => {
    active911.startup();
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
    let gMapInitialized;
    updateTimer();

    active911.on('active-alert-timer-start', showActiveAlert);
    active911.on('active-alert-timer-stop', clearActiveAlert);

    $('#active911\\:googleMaps\\:zoom-value > span').text(active911Settings.config.googleMaps.zoom);
    $('#active911\\:googleMaps\\:zoom').bootstrapSlider('setValue', active911Settings.config.googleMaps.zoom);

    $('#active911\\:googleMaps\\:zoom').on('slide', function (slideEvt) {
        $('#active911\\:googleMaps\\:zoom-value > span').text(slideEvt.value);
    });

    $('#launch-google').on('click', function (e) {
        e.preventDefault();
        ipcRenderer.send('launch-google');
    });

    ko.observableArray.fn.vocabularyExists = function (value, objectKey) {
        return ko.pureComputed(() => {
            let allItems = this(), i=0;
            for (i; i < allItems.length; i++) {
                if (ko.unwrap(allItems[i][objectKey]).toLowerCase() === value.toLowerCase()) {
                    return true;
                }
            }
            return false;
        }, this);
    };

    ko.observableArray.fn.getItemById = function (value) {
        let allItems = this(), i=0;
        for (i; i < allItems.length; i++) {
            if (ko.unwrap(allItems[i].id) === value) {
                return allItems[i];
            }
        }

        return false;
    };

    ko.observableArray.fn.retrieve = function (value, objectKey) {
        let allItems = this(), i=0, unwrapped;
        for (i; i<allItems.length; i++) {
            unwrapped = ko.unwrap(allItems[i][objectKey]);
            if (typeof value === "string") {
                if (unwrapped.toLowerCase() === value.toLowerCase()) {
                    return allItems[i];
                }
            } else if (unwrapped === value) {
                return allItems[i];
            }
        }
        return ko.pureComputed(() => { return undefined });
    };

    /** Support bootstrap-toggle checkbox elements **/
    ko.bindingHandlers.toggled = {
        init: (elem, valueAccessor) => {
            $(elem).prop('checked', ko.unwrap(valueAccessor())).change();
            $(elem).change(() => {
                let value = valueAccessor();
                value($(elem).prop('checked'));
            });
        }
    };

    active911SettingsModel = ko.mapping.fromJS(active911Settings.config);
    active911SettingsModel.afterResponseVocabularyRender = function (element, vocabWord) {
        $(element).filter('li').attr('id', vocabWord.id());
    };
    active911SettingsModel.active911.responseVocabulary = ko.observableArray();

    for (let i=0; i<active911Settings.config.active911.responseVocabulary.length; i++) {
        active911SettingsModel.active911.responseVocabulary.push(
            new VocabularyWord(
                active911Settings.config.active911.responseVocabulary[i].term,
                active911Settings.config.active911.responseVocabulary[i].label,
                typeof active911Settings.config.active911.responseVocabulary[i].order !== "undefined"
                    ? parseInt(active911Settings.config.active911.responseVocabulary[i].order) : -1,
                typeof active911Settings.config.active911.responseVocabulary[i].id !== "undefined"
                    ? active911Settings.config.active911.responseVocabulary[i].id : null,

            )
        );
    }

    active911SettingsModel.addVocabulary = function () {
        let self = this;
        self.active911.responseVocabulary.push(new VocabularyWord("", ""));
    };
    active911SettingsModel.removeVocabulary = function (vocabulary) {
        active911SettingsModel.active911.responseVocabulary.remove(vocabulary);
        active911SettingsModel.reorderVocabularyTerms({ sourceParentNode: $('#active911\\:response-vocabulary-list') });
    };
    active911SettingsModel.reorderVocabularyTerms = function (evt) {
        $('li', evt.sourceParentNode).each((idx, elem) => {
            active911SettingsModel.active911.responseVocabulary.getItemById(elem.id).order(idx);
        });
    };
    active911SettingsModel.toggleIncludeWatchers = ko.observable(active911Settings.config.active911.showWatchers || false);
    active911SettingsModel.panToShowAllMarkers = ko.observable(active911Settings.config.mapOptions.panToShowAllMarkers || false);
    ko.applyBindings(active911SettingsModel);
    writeSettings();

    $('#active911\\:settings').dependentFields();

    /** Add Bootstrap v4 support to bootstrap-toggle library **/
    $('.btn-default').each((i, elem) => {
        $(elem).addClass('btn-light');
    });

    gMapInitialized = initGoogleMap();

    active911.startup();

    if (!gMapInitialized) {
        $('#active911\\:google-maps-api').addClass('is-invalid');
        $('#active911\\:open-settings').click();
    }
});