const Storage = {

    get(key, fallback = null) {

        try {

            const value = localStorage.getItem(key);

            if (!value) {
                return fallback;
            }

            return JSON.parse(value);

        } catch {

            return fallback;
        }
    },

    set(key, value) {

        localStorage.setItem(
            key,
            JSON.stringify(value)
        );
    },

    remove(key) {

        localStorage.removeItem(key);
    }
};

function getProfiles() {

    let profiles = Storage.get("profiles");

    if (!profiles) {

        // Build default profiles from PRESET_PROFILES config
        profiles = {};
        Object.keys(PRESET_PROFILES).forEach(function(name) {
            profiles[name] = {
                name: name,
                apiUrl: PRESET_PROFILES[name].apiUrl || "",
                paymentModes: APP_CONFIG.DEFAULT_PAYMENT_MODES.slice(),
                theme: APP_CONFIG.DEFAULT_THEME,
                autoHideToast: true
            };
        });

        Storage.set(
            "profiles",
            profiles
        );
    }

    return profiles;
}

function saveProfiles(profiles) {

    Storage.set(
        "profiles",
        profiles
    );
}

function getCurrentProfile() {

    let current =
        Storage.get(
            "currentProfile",
            APP_CONFIG.DEFAULT_PROFILE
        );

    const profiles =
        getProfiles();

    if (!profiles[current]) {

        current =
            Object.keys(profiles)[0];

        Storage.set(
            "currentProfile",
            current
        );
    }

    return current;
}

function setCurrentProfile(name) {

    Storage.set(
        "currentProfile",
        name
    );
}

function getActiveProfile() {

    const profiles =
        getProfiles();

    return profiles[
        getCurrentProfile()
    ];
}

function saveActiveProfile(profile) {

    const profiles =
        getProfiles();

    profiles[
        getCurrentProfile()
    ] = profile;

    saveProfiles(profiles);
}

/**
 * One-time migration: upgrade stored 'system' theme to APP_CONFIG.DEFAULT_THEME.
 * Called on startup to ensure existing users get the new light default.
 */
function migrateThemeDefault() {
    // One-time guard: skip entirely if migration was already applied
    if (Storage.get('rb_migrated_theme_v2')) return;
    const profiles = getProfiles();
    let changed = false;
    Object.values(profiles).forEach(function(p) {
        if (p.theme === 'system') {
            p.theme = APP_CONFIG.DEFAULT_THEME;
            changed = true;
        }
    });
    if (changed) saveProfiles(profiles);
    Storage.set('rb_migrated_theme_v2', true); // mark done permanently
}