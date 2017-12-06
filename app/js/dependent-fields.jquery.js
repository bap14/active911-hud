(function ($) {
    "use strict";

    $.fn.dependentFields = function () {
        $('[data-dependent]', this).each((idx, elem) => {
            let dependencies = $(elem).data('dependent'),
                dependent = $(elem);
            $.each(dependencies, (key) => {
                let dependency = $('#' + key.replace(':', '\\:')),
                    dependencyValue = dependencies[key];
                if (dependency.length) {
                    if (dependency.val() != dependencyValue) dependent.hide();
                    else dependent.show();
                    dependency.on('change', (e) => {
                        if ($(e.target).val() == dependencyValue) dependent.show();
                        else dependent.hide();
                    });
                    dependency.change();
                }
            });
        });

        return this;
    }
})(jQuery);