const {updateActionsObject, checkMatchPredicate} = require('./actions.js');

describe('checkMatchPredicate(...)', () => {
    describe.each([
        ["Obj.+\\s.*", ["[Object object]", "oBjX\n", {}, {a: 15}], [15, "Obj.*\s.*", "oBj\n", "heyo"]],
        [3, [3, "3", "3.00000"], [3.000001, {}]],
        [true, [true, 1, "ok", {}, []], ["", 0, false]],
        [{1: "false"}, [{1: false}, {1: "false", b: 15}, [10, false]], [{1: 15}, {}]],
        [["obj === '15'"], ["15"], [15, "abc", {}]]
    ])('given a valid match predicate', (predicate, matches, notMatches) => {
        test('matches the objects it should match', () => {
            for (const match of matches) {
                expect(checkMatchPredicate(predicate, match)).toBe(true);
            }
        });

        test('matches the objects it should not match', () => {
            for (const notMatch of notMatches) {
                expect(checkMatchPredicate(predicate, notMatch)).toBe(false);
            }
        });
    });
});

describe('updateActionsObject(...)', () => {
    describe.each([
        [[]],
        [[
            {
                match: {regex: 'HI', probability: 0.5},
                response: ['text', 'Hello, world!'],
            },
            {
                match: {regex: '.'},
                response: ['sticker', '1234abc'],
            },
        ]],
    ])('given a valid actions object', (obj) => {
        test('updateActionsObject returns the same object', () => {
            expect(updateActionsObject(obj)).toBe(obj);
        });
    });


    describe.each([
        [{}, []],
        [{
            'HI': {
                probability: 0.5,
                text: 'Hello, world!',
            },
            'HI2': {
                text: 'No hello to you!!',
            },
            '.': {
                sticker: '1234abc',
            },
            'abc*ab': {
                probability: 0.0001,
                markov: true,
            },
        }, [
            ['HI', 0.5, 'Hello, world!'],
            ['HI2', 1, 'No hello to you!!'],
            {
                match: {text: '.'},
                response: ['sticker', '1234abc'],
            },
            {
                match: {text: 'abc*ab'},
                probability: 0.0001,
                response: 'markov',
            },
        ]],
    ])('given an outdated actions object', (outdated, updated) => {
        test('updateActionsObject returns the same object, but updated', () => {
            expect(updateActionsObject(outdated)).toEqual(updated);
        });
    });
});


describe('isMatchingMessage()', () => {

});

