import ResponseValidator from '../src/ResponseValidator';
import Log from '../src/Log';

import StubMetadataService from './StubMetadataService';

import chai from 'chai';
chai.should();
let assert = chai.assert;
let expect = chai.expect;

class StubUserInfoService {
    getClaims() {
        this.getClaimsWasCalled = true;
        return this.getClaimsResult;
    }
}
class MockResponseValidator extends ResponseValidator {
    constructor(settings, MetadataServiceCtor, UserInfoServiceCtor) {
        super(settings, MetadataServiceCtor, UserInfoServiceCtor);
    }

    _mock(name, ...args) {
        Log.info("mock called", name);
        this[name + "WasCalled"] = true;

        if (this[name + "Result"]) {
            Log.info("mock returning result", this[name + "Result"]);
            return this[name + "Result"];
        }

        Log.info("mock calling super");
        return super[name](...args);
    }

    processSigninParams(...args) {
        return this._mock("processSigninParams", ...args);
    }
    validateTokens(...args) {
        return this._mock("validateTokens", ...args);
    }
    processClaims(...args) {
        return this._mock("processClaims", ...args);
    }
    mergeClaims(...args) {
        return this._mock("mergeClaims", ...args);
    }

    validateIdTokenAndAccessToken(...args) {
        return this._mock("validateIdTokenAndAccessToken", ...args);
    }
    validateIdToken(...args) {
        return this._mock("validateIdToken", ...args);
    }
    validateAccessToken(...args) {
        return this._mock("validateAccessToken", ...args);
    }

    filterProtocolClaims(...args) {
        return this._mock("filterProtocolClaims", ...args);
    }
}

describe("ResponseValidator", function() {
    let settings;
    let subject;
    let stubMetadataService;
    let stubUserInfoService;

    let stubState;
    let stubResponse;

    beforeEach(function() {
        Log.setLogger(console);
        Log.level = Log.NONE;

        stubState = {
            id: "the_id",
            data: { some: 'data' }
        };
        stubResponse = {
            state: 'the_id'
        };

        settings = {};
        stubMetadataService = new StubMetadataService();
        stubUserInfoService = new StubUserInfoService();
        subject = new MockResponseValidator(settings, () => stubMetadataService, () => stubUserInfoService);
    });

    describe("constructor", function() {

        it("should require a settings param", function() {
            try {
                new ResponseValidator(undefined, () => stubMetadataService, () => stubUserInfoService);
            }
            catch (e) {
                e.message.should.contain('settings');
                return;
            }
            assert.fail();
        });

    });

    describe("validateSignoutResponse", function(done) {

        it("should validate that the client state matches response state", function() {

            stubResponse.state = "not_the_id";
            subject.validateSignoutResponse(stubState, stubResponse).then(null, err => {
                err.message.should.contain('match');
                done();
            });

        });

        it("should fail on error response", function(done) {

            stubResponse.error = "some_error";
            subject.validateSignoutResponse(stubState, stubResponse).then(null, err => {
                err.error.should.equal("some_error");
                done();
            });

        });

        it("should return data for error responses", function(done) {

            stubResponse.error = "some_error";
            subject.validateSignoutResponse(stubState, stubResponse).then(null, err => {
                err.state.should.deep.equal({ some: 'data' });
                done();
            });

        });

        it("should return data for successful responses", function(done) {

            subject.validateSignoutResponse(stubState, stubResponse).then(response => {
                response.state.should.deep.equal({ some: 'data' });
                done();
            });

        });

    });

    describe("validateSigninResponse", function(done) {

        it("should process signin params", function(done) {

            subject.processSigninParamsResult = Promise.resolve(stubResponse);
            subject.validateTokensResult = Promise.resolve(stubResponse);

            subject.validateSigninResponse(stubState, stubResponse).then(response => {
                subject.processSigninParamsWasCalled.should.be.true;
                done();
            });

        });

        it("should validate tokens", function(done) {

            subject.processSigninParamsResult = Promise.resolve(stubResponse);
            subject.validateTokensResult = Promise.resolve(stubResponse);

            subject.validateSigninResponse(stubState, stubResponse).then(response => {
                subject.validateTokensWasCalled.should.be.true;
                done();
            });

        });

        it("should not validate tokens if state fails", function(done) {

            subject.processSigninParamsResult = Promise.reject("error");
            subject.validateTokensResult = Promise.resolve(stubResponse);

            subject.validateSigninResponse(stubState, stubResponse).then(null, err => {
                expect(subject.validateTokensWasCalled).to.be.undefined;
                done();
            });

        });

        it("should process claims", function(done) {

            subject.processSigninParamsResult = Promise.resolve(stubResponse);
            subject.validateTokensResult = Promise.resolve(stubResponse);

            subject.validateSigninResponse(stubState, stubResponse).then(response => {
                subject.processClaimsWasCalled.should.be.true;
                done();
            });

        });

        it("should not process claims if state fails", function(done) {

            subject.processSigninParamsResult = Promise.resolve(stubResponse);
            subject.validateTokensResult = Promise.reject("error");

            subject.validateSigninResponse(stubState, stubResponse).then(null, err => {
                expect(subject.processClaimsWasCalled).to.be.undefined;
                done();
            });

        });

    });

    describe("processSigninParams", function() {

        it("should validate that the client state matches response state", function() {

            stubResponse.state = "not_the_id";
            subject.processSigninParams(stubState, stubResponse).then(null, err => {
                err.message.should.contain('match');
                done();
            });

        });

        it("should fail on error response", function(done) {

            stubResponse.error = "some_error";
            subject.processSigninParams(stubState, stubResponse).then(null, err => {
                err.error.should.equal("some_error");
                done();
            });

        });

        it("should return data for error responses", function(done) {

            stubResponse.error = "some_error";
            subject.processSigninParams(stubState, stubResponse).then(null, err => {
                err.state.should.deep.equal({ some: 'data' });
                done();
            });

        });

        it("should fail if request was OIDC but no id_token in response", function(done) {

            stubState.nonce = "some_nonce";
            delete stubResponse.id_token;

            subject.processSigninParams(stubState, stubResponse).then(null, err => {
                err.message.should.contain("id_token");
                done();
            });

        });

        it("should fail if request was not OIDC but id_token in response", function(done) {

            stubResponse.id_token = "id_token";

            subject.processSigninParams(stubState, stubResponse).then(null, err => {
                err.message.should.contain("id_token");
                done();
            });

        });

        it("should return data for successful responses", function(done) {

            subject.processSigninParams(stubState, stubResponse).then(response => {
                response.state.should.deep.equal({ some: 'data' });
                done();
            });

        });
    });

    describe("processClaims", function() {

        it("should filter protocol claims", function(done) {

            subject.processClaims(stubState, stubResponse).then(response => {
                subject.filterProtocolClaimsWasCalled.should.be.true;
                done();
            });

        });

        it("should load and merge user info claims when loadUserInfo configured", function(done) {

            settings.loadUserInfo = true;
            stubResponse.profile = { a: 'apple', b: 'banana' };
            stubUserInfoService.getClaimsResult = Promise.resolve({ c: 'carrot' });

            subject.processClaims(stubResponse).then(response => {
                stubUserInfoService.getClaimsWasCalled.should.be.true;
                subject.mergeClaimsWasCalled.should.be.true;
                done();
            });

        });

        it("should not load and merge user info claims when loadUserInfo not configured", function(done) {

            settings.loadUserInfo = false;
            stubResponse.profile = { a: 'apple', b: 'banana' };
            stubUserInfoService.getClaimsResult = Promise.resolve({ c: 'carrot' });

            subject.processClaims(stubResponse).then(response => {
                expect(stubUserInfoService.getClaimsWasCalled).to.be.undefined;
                expect(subject.mergeClaimsWasCalled).to.be.undefined;
                done();
            });

        });

    });


    describe("mergeClaims", function() {

        it("should merge claims", function() {

            var c1 = { a: 'apple', b: 'banana' };
            var c2 = { c: 'carrot' };

            var result = subject.mergeClaims(c1, c2);
            result.should.deep.equal({ a: 'apple', c: 'carrot', b: 'banana' });

        });

        it("should merge same claim types into array", function() {

            var c1 = { a: 'apple', b: 'banana' };
            var c2 = { a: 'carrot' };

            var result = subject.mergeClaims(c1, c2);
            result.should.deep.equal({ a: ['apple', 'carrot'], b: 'banana' });

        });

        it("should merge arrays of same claim types into array", function() {

            var c1 = { a: 'apple', b: 'banana' };
            var c2 = { a: ['carrot', 'durian'] };
            var result = subject.mergeClaims(c1, c2);
            result.should.deep.equal({ a: ['apple', 'carrot', 'durian'], b: 'banana' });

            var c1 = { a: ['apple', 'carrot'], b: 'banana' };
            var c2 = { a: ['durian'] };
            var result = subject.mergeClaims(c1, c2);
            result.should.deep.equal({ a: ['apple', 'carrot', 'durian'], b: 'banana' });

            var c1 = { a: ['apple', 'carrot'], b: 'banana' };
            var c2 = { a: 'durian' };
            var result = subject.mergeClaims(c1, c2);
            result.should.deep.equal({ a: ['apple', 'carrot', 'durian'], b: 'banana' });
        });
    });

    describe("filterProtocolClaims", function() {

        it("should filter protocol claims if enabled on settings", function() {

            settings.filterProtocolClaims = true;
            let claims = {
                foo: 1, bar: 'test',
                aud: 'some_aud', iss: 'issuer',
                sub: '123', email: 'foo@gmail.com',
                role: ['admin', 'dev'],
                nonce: 'nonce', at_hash: "athash",
                iat: 5, nbf: 10, exp: 20
            };

            var result = subject.filterProtocolClaims(claims);
            result.should.deep.equal({
                foo: 1, bar: 'test',
                sub: '123', email: 'foo@gmail.com',
                role: ['admin', 'dev']
            });

        });

        it("should not filter protocol claims if not enabled on settings", function() {

            settings.filterProtocolClaims = false;
            let claims = {
                foo: 1, bar: 'test',
                aud: 'some_aud', iss: 'issuer',
                sub: '123', email: 'foo@gmail.com',
                role: ['admin', 'dev'],
                nonce: 'nonce', at_hash: "athash",
                iat: 5, nbf: 10, exp: 20
            };

            var result = subject.filterProtocolClaims(claims);
            result.should.deep.equal({
                foo: 1, bar: 'test',
                aud: 'some_aud', iss: 'issuer',
                sub: '123', email: 'foo@gmail.com',
                role: ['admin', 'dev'],
                nonce: 'nonce', at_hash: "athash",
                iat: 5, nbf: 10, exp: 20
            });

        });
    });

    describe("validateTokens", function() {

        it("should validate id_token and access_token", function(done) {

            stubResponse.id_token = "id_token";
            stubResponse.access_token = "access_token";
            subject.validateIdTokenAndAccessTokenResult = Promise.resolve(stubResponse);

            subject.validateTokens(stubState, stubResponse).then(response => {
                subject.validateIdTokenAndAccessTokenWasCalled.should.be.true;
                expect(subject.validateIdTokenWasCalled).to.be.undefined;
                done();
            });

        });

        it("should validate just id_token", function(done) {

            stubResponse.id_token = "id_token";
            subject.validateIdTokenResult = Promise.resolve(stubResponse);

            subject.validateTokens(stubState, stubResponse).then(response => {
                subject.validateIdTokenWasCalled.should.be.true;
                expect(subject.validateIdTokenAndAccessTokenWasCalled).to.be.undefined;
                done();
            });

        });

        it("should not validate if only access_token", function(done) {

            stubResponse.access_token = "access_token";

            subject.validateTokens(stubState, stubResponse).then(response => {
                expect(subject.validateIdTokenWasCalled).to.be.undefined;
                expect(subject.validateIdTokenAndAccessTokenWasCalled).to.be.undefined;
                done();
            });

        });
    });

    describe("validateIdTokenAndAccessToken", function() {

        it("should validate id_token and access_token", function(done) {

            stubResponse.id_token = "id_token";
            stubResponse.access_token = "access_token";
            subject.validateIdTokenResult = Promise.resolve(stubResponse);

            subject.validateIdTokenAndAccessToken(stubState, stubResponse).then(response => {
                subject.validateIdTokenWasCalled.should.be.true;
                subject.validateAccessTokenWasCalled.should.be.true;
                done();
            });

        });

        it("should not access_token if id_token validation fails", function(done) {

            stubResponse.id_token = "id_token";
            stubResponse.access_token = "access_token";
            subject.validateIdTokenResult = Promise.reject(new Error("error"));

            subject.validateIdTokenAndAccessToken(stubState, stubResponse).then(null, err => {
                subject.validateIdTokenWasCalled.should.be.true;
                expect(subject.validateAccessTokenWasCalled).to.be.undefined;
                done();
            });

        });

    });

    describe("validateIdToken", function() {
        
    });
    
    describe("validateAccessToken", function() {
        
    });
});
