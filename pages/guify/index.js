// Parse params from URL
function getParameterByName(name, url) {
    if (!url) url = window.location.href;
    name = name.replace(/[\[\]]/g, "\\$&");
    var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
        results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return '';
    return decodeURIComponent(results[2].replace(/\+/g, " "));
}

// Add or update param
// https://stackoverflow.com/a/15023688
function updateQueryStringParameter(uri, key, value) {
    var re = new RegExp("([?&])" + key + "=.*?(&|#|$)", "i");
    if( value === undefined ) {
        if (uri.match(re)) {
            return uri.replace(re, '$1$2');
        } else {
            return uri;
        }
    } else {
        if (uri.match(re)) {
            return uri.replace(re, '$1' + key + "=" + value + '$2');
        } else {
            var hash =  '';
            if( uri.indexOf('#') !== -1 ){
                hash = uri.replace(/.*#/, '#');
                uri = uri.replace(/#.*/, '');
            }
            var separator = uri.indexOf('?') !== -1 ? "&" : "?";    
            return uri + separator + key + "=" + value + hash;
        }
    }  
}

function onThemeChange(val) {
    window.location.href = updateQueryStringParameter(window.location.href, 'theme', val);
}

function onBarmodeChange(val) {
    window.location.href = updateQueryStringParameter(window.location.href, 'barmode', val);
}


var container = document.getElementById("guify-container");
//var root = document.getElementsByTagName('main')[0];

// Create the GUI
var gui = new guify.GUI({
    title: 'Guify App',
    theme: getParameterByName('theme') || 'dark', // dark, light, yorha, or theme object
    align: 'right', // left, right
    width: 350,
    barMode: getParameterByName('barmode') || 'above', // none, overlay, above, offset
    opacity: 0.95,
    root: container,
    open: true
});

// Populate the GUI

var someNumber = 0;
gui.Register({
    type: 'range',
    label: 'Test',
    min: 0, max: 10, step: 1,
    object: this, property: "someNumber",
    onChange: (data) => {
        console.log(someNumber);
    }
});

gui.Register({
    type: 'title',
    label: 'Test Title'
});


var logNumber = 20;
gui.Register({
    type: 'range',
    label: 'Log Range Test',
    object: this,
    property: 'logNumber',
    min: 0.1, max: 100, scale: 'log',
    onChange: (data) => {
        console.log(logNumber);
    }
})

gui.Register({
    type: 'button',
    label: 'Test Button',
    action: () => {
        console.log('Clicked');
    }
})

var checkboxTest = false;
gui.Register({
    type: 'checkbox',
    label: 'Test Checkbox',
    object: this,
    property: 'checkboxTest',
    onChange: (data) => {
        console.log(checkboxTest);
    }
})

var testSelection = 'Option 1';
gui.Register({
    type: 'select',
    label: 'Test Select',
    object: this,
    property: 'testSelection',
    options: ['Option 1', 'Option 2'],
    onChange: (data) => {
        console.log(testSelection);
    }
})

var testText = 'Some text here';
gui.Register({
    type: 'text',
    label: '',
    object: this,
    property: 'testText',
    onChange: (data) => {
        console.log(testText);
    }
})

var rgbColor = 'rgb(255, 0, 0)';
gui.Register({
    type: 'color',
    label: 'Test RGB',
    format: 'rgb',
    object: this,
    property: 'rgbColor'
})

var hexColor = '#00FF00';
gui.Register({
    type: 'color',
    label: 'Test Hex',
    format: 'hex',
    object: this,
    property: 'hexColor'
})

var file = null;
gui.Register({
    type: 'file',
    label: 'Test File',
    object: this,
    property: 'file',
    onChange: (data) => {
        console.log(data);
    }
})

var displayValue = "Displays the toString representation of a variable.";
gui.Register({
    type: 'display',
    label: 'Test Display',
    object: this,
    property: 'displayValue'
})

// Folder example
gui.Register({
    type: 'folder',
    label: 'Test Folder',
    open: false
});

// Add to the folder example
gui.Register([
    { type: 'title', label: 'Folder Title' },
    { type: 'range', label: 'Folder Range', min: 0, max: 20, step: 1 },
    { type: 'button', label: 'Folder Button' },
    { type: 'checkbox', label: 'Folder Checkbox' },
    { type: 'select', label: 'Folder Select', options: ["Option A", "Option B"] },
    { type: 'text', label: 'Folder Text', initial: 'Some text' },
    { type: 'color', label: 'Folder Color' },
], {
    folder: 'Test Folder'
});

gui.Register({
    type: 'text',
    label: 'long long long long long long long long label',
    folder: 'Test Folder',
})

// Add a nested folder
gui.Register({ type: 'folder', label: 'Nested Folder', folder: 'Test Folder', open: false });
gui.Register({ type: 'text', label: 'Folder Text', folder: 'Nested Folder', initial: 'Nested text' });

// Debug folder
gui.Register({
    type: 'folder',
    label: 'Debug',
    open: false
})

gui.Register({
    type: 'button',
    label: 'Toast Test',
    folder: 'Debug',
    action: () => {
        // Send a toast
        gui.Toast('Test Toast');
    },
})

gui.Register({
    type: 'button',
    label: 'Randomize Bound Values',
    folder: 'Debug',
    action: () => {
        // Randomize all the values bound to components in this example.
        // Good test for whether component binding is actually working.
        someNumber = Math.random() * 10;
        logNumber = Math.random() * 99 + 0.1;
        checkboxTest = !checkboxTest;

        testText = (Math.random() + 1).toString(36).substring(7); // Random string
        rgbColor = 'rgb(' + Math.random() * 255 + ', 0, 0)';
        hexColor = "#";
        for(var i = 0; i < 6; i++) hexColor += Math.floor(Math.random() * 9).toString()

        testSelection = "Option " + (Math.random() < 0.5 ? "1" : "2");
    }
})