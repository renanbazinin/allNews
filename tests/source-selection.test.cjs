const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');

function fixture() {
    const sources = ['bbc', 'nyt', 'ynet', 'maariv', 'n12', 'rotter', 'walla', 'haaretz'];
    const elements = Object.fromEntries(sources.map(source => [`${source}-checkbox`, {
        checked: true, handlers: {}, removeAttribute() {},
        addEventListener(type, handler) { this.handlers[type] = handler; }
    }]));
    elements['reading-feedback'] = {};
    const context = vm.createContext({
        document: { getElementById: id => elements[id], addEventListener() {} },
        window: { addEventListener() {} }
    });
    vm.runInContext(readFileSync(require.resolve('../public/scripts.js'), 'utf8'), context);
    // Isolate selection from rendering/network; the browser checks cover those paths.
    vm.runInContext('toggleSourceSelection = () => {}; setupCheckboxHandlers();', context);
    return {
        selected: () => sources.filter(source => elements[`${source}-checkbox`].checked),
        activate(source, timeStamp, detail = 1, pointerType = 'touch') {
            const box = elements[`${source}-checkbox`];
            box.checked = !box.checked;
            box.handlers.click({ timeStamp, detail, pointerType });
            box.handlers.change();
        },
        key(source) {
            let prevented = false;
            elements[`${source}-checkbox`].handlers.keydown({ key: 'Enter', altKey: true, preventDefault() { prevented = true; } });
            assert.ok(prevented);
        }
    };
}

test('double touch selects one source even when touch clicks have zero detail', () => {
    const app = fixture();
    app.activate('ynet', 100, 0);
    app.activate('ynet', 300, 0);
    assert.deepEqual(app.selected(), ['ynet']);
});

test('slow single taps and taps on different sources remain ordinary toggles', () => {
    const app = fixture();
    app.activate('ynet', 100);
    app.activate('ynet', 600);
    assert.equal(app.selected().length, 8);
    app.activate('maariv', 700);
    assert.equal(app.selected().length, 7);
    assert.ok(!app.selected().includes('maariv'));
});

test('desktop double-click respects OS click count beyond the touch interval', () => {
    const app = fixture();
    app.activate('ynet', 100, 1, 'mouse');
    app.activate('ynet', 650, 2, 'mouse');
    assert.deepEqual(app.selected(), ['ynet']);
});

test('keyboard toggles stay independent while Alt+Enter selects exclusively', () => {
    const app = fixture();
    app.activate('ynet', 100, 0, '');
    app.activate('ynet', 200, 0, '');
    assert.equal(app.selected().length, 8);
    app.key('haaretz');
    assert.deepEqual(app.selected(), ['haaretz']);
});
