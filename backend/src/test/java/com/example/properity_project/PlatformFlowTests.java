package com.example.properity_project;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Walks the whole business flow and checks the authorization and privacy rules on the way. */
@SpringBootTest(properties = {
        "app.agent.email=agent@test.com", "app.agent.password=Agent@12345",
        "app.storage.dir=target/test-storage", "app.rate-limit.max-requests=1000", "app.dev-expose-otp=true"})
@AutoConfigureMockMvc
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class PlatformFlowTests {

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;

    static String agent, seller, buyer, buyer2;
    static long sellerId, propertyId, enquiryId, verificationId;
    static final byte[] PNG = {(byte) 0x89, 'P', 'N', 'G', 13, 10, 26, 10, 0, 0};
    static final byte[] PDF = "%PDF-1.4 test".getBytes();

    // ------------------------------------------------------------ helpers

    JsonNode body(ResultActions r) throws Exception {
        return json.readTree(r.andReturn().getResponse().getContentAsString());
    }

    ResultActions postJ(String url, String token, Object payload) throws Exception {
        var b = post(url).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(payload));
        if (token != null) b.header("Authorization", "Bearer " + token);
        return mvc.perform(b);
    }

    ResultActions getJ(String url, String token) throws Exception {
        var b = get(url);
        if (token != null) b.header("Authorization", "Bearer " + token);
        return mvc.perform(b);
    }

    /** Registers, verifies email + mobile with the demo codes, and returns the token. */
    String registerVerified(String name, String email, String phone, String purpose) throws Exception {
        JsonNode res = body(postJ("/api/auth/register", null, Map.ofEntries(
                Map.entry("fullName", name), Map.entry("email", email), Map.entry("phone", phone),
                Map.entry("address", "12 Test Street"), Map.entry("city", "Chandigarh"), Map.entry("state", "Punjab"),
                Map.entry("postalCode", "160017"), Map.entry("password", "Passw0rdOK"), Map.entry("purpose", purpose)))
                .andExpect(status().isOk()));
        String token = res.get("token").asText();
        postJ("/api/me/verify", token, Map.of("channel", "EMAIL", "code", res.get("devEmailCode").asText())).andExpect(status().isOk());
        postJ("/api/me/verify", token, Map.of("channel", "PHONE", "code", res.get("devPhoneCode").asText())).andExpect(status().isOk());
        return token;
    }

    String login(String email, String password, String portal) throws Exception {
        return body(postJ("/api/auth/login", null, Map.of("email", email, "password", password, "portal", portal))
                .andExpect(status().isOk())).get("token").asText();
    }

    // ------------------------------------------------------------ tests

    @BeforeAll
    static void clean() {
    }

    @Test @Order(1)
    void portalsAreSeparatedAndAgentCannotSignUp() throws Exception {
        agent = login("agent@test.com", "Agent@12345", "AGENT");
        postJ("/api/auth/login", null, Map.of("email", "agent@test.com", "password", "Agent@12345", "portal", "CUSTOMER"))
                .andExpect(status().isUnauthorized());
        // no agent registration route exists
        mvc.perform(post("/api/auth/register-agent").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().is4xxClientError());

        seller = registerVerified("Sam Seller", "sam@test.com", "9876500001", "SELL");
        buyer = registerVerified("Bella Buyer", "bella@test.com", "9876500002", "BUY");
        buyer2 = registerVerified("Bob Other", "bob@test.com", "9876500003", "BUY");
        postJ("/api/auth/login", null, Map.of("email", "sam@test.com", "password", "Passw0rdOK", "portal", "AGENT"))
                .andExpect(status().isUnauthorized());
        postJ("/api/auth/login", null, Map.of("email", "sam@test.com", "password", "wrong-pass1", "portal", "CUSTOMER"))
                .andExpect(status().isUnauthorized());
    }

    @Test @Order(2)
    void customersCannotReachAgentApis() throws Exception {
        getJ("/api/agent/dashboard", buyer).andExpect(status().isForbidden());
        getJ("/api/agent/customers", seller).andExpect(status().isForbidden());
        getJ("/api/agent/dashboard", null).andExpect(status().isUnauthorized());
        getJ("/api/agent/dashboard", agent).andExpect(status().isOk());
    }

    @Test @Order(3)
    void sellerMustBeVerifiedBeforeListing() throws Exception {
        Map<String, Object> property = propertyPayload();
        postJ("/api/seller/properties", seller, property).andExpect(status().isForbidden());

        // uploading documents is not verification
        var app = multipart("/api/me/seller-application")
                .file(new MockMultipartFile("identity", "id.pdf", "application/pdf", PDF))
                .file(new MockMultipartFile("address", "addr.pdf", "application/pdf", PDF))
                .file(new MockMultipartFile("photo", "me.png", "image/png", PNG))
                .param("consent", "true").header("Authorization", "Bearer " + seller);
        JsonNode v = body(mvc.perform(app).andExpect(status().isOk()));
        assertEquals("PENDING", v.get("status").asText());
        verificationId = v.get("id").asLong();
        postJ("/api/seller/properties", seller, property).andExpect(status().isForbidden());

        // bad file type rejected
        var bad = multipart("/api/me/seller-application")
                .file(new MockMultipartFile("identity", "id.exe", "application/octet-stream", PDF))
                .param("consent", "true").header("Authorization", "Bearer " + buyer);
        mvc.perform(bad).andExpect(status().isBadRequest());

        // other customers cannot download the seller's identity document
        long docId = v.get("documents").get(0).get("id").asLong();
        getJ("/api/files/verification-documents/" + docId, buyer).andExpect(status().isNotFound());
        getJ("/api/files/verification-documents/" + docId, seller).andExpect(status().isOk());
        getJ("/api/files/verification-documents/" + docId, agent).andExpect(status().isOk());

        // reject needs a reason, then approve
        postJ("/api/agent/verifications/" + verificationId + "/decision", agent, Map.of("action", "REJECT")).andExpect(status().isBadRequest());
        postJ("/api/agent/verifications/" + verificationId + "/decision", agent, Map.of("action", "APPROVE")).andExpect(status().isOk());
        JsonNode me = body(getJ("/api/account/me", seller).andExpect(status().isOk()));
        assertTrue(me.get("sellerEnabled").asBoolean());
        assertEquals("VERIFIED", me.get("sellerStatus").asText());
        sellerId = me.get("id").asLong();
    }

    @Test @Order(4)
    void listingWorkflowAndPublicPrivacy() throws Exception {
        JsonNode created = body(postJ("/api/seller/properties", seller, propertyPayload()).andExpect(status().isOk()));
        propertyId = created.get("id").asLong();
        assertEquals("DRAFT", created.get("status").asText());

        // cannot submit without photo / ownership document
        postJ("/api/seller/properties/" + propertyId + "/submit", seller, Map.of()).andExpect(status().isBadRequest());
        mvc.perform(multipart("/api/seller/properties/" + propertyId + "/images")
                .file(new MockMultipartFile("files", "a.png", "image/png", PNG)).header("Authorization", "Bearer " + seller))
                .andExpect(status().isOk());
        mvc.perform(multipart("/api/seller/properties/" + propertyId + "/documents")
                .file(new MockMultipartFile("file", "deed.pdf", "application/pdf", PDF)).param("docType", "OWNERSHIP")
                .header("Authorization", "Bearer " + seller)).andExpect(status().isOk());
        // another customer cannot touch this listing (IDOR)
        postJ("/api/seller/properties/" + propertyId + "/submit", buyer, Map.of()).andExpect(status().isForbidden());
        postJ("/api/seller/properties/" + propertyId + "/submit", seller, Map.of()).andExpect(status().isOk());

        // not visible until approved
        getJ("/api/properties/" + propertyId, null).andExpect(status().isNotFound());
        assertEquals(0, body(getJ("/api/properties", null)).get("page").get("totalElements").asInt());

        postJ("/api/agent/properties/" + propertyId + "/decision", agent, Map.of("action", "REJECT")).andExpect(status().isBadRequest());
        postJ("/api/agent/properties/" + propertyId + "/decision", agent, Map.of("action", "APPROVE")).andExpect(status().isOk());

        String list = getJ("/api/properties?city=Chandigarh&sort=price_asc", null).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        assertTrue(list.contains("Test Villa"));
        String detail = getJ("/api/properties/" + propertyId, buyer).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        for (String secret : new String[]{"sam@test.com", "9876500001", "Sam Seller", "sellerId"}) {
            assertFalse(detail.contains(secret), "public detail leaked " + secret);
            assertFalse(list.contains(secret), "public list leaked " + secret);
        }
        // filters work
        assertEquals(0, body(getJ("/api/properties?minPrice=99999999", null)).get("page").get("totalElements").asInt());
        assertEquals(1, body(getJ("/api/properties?bhk=3&category=SALE", null)).get("page").get("totalElements").asInt());

        // wishlist
        postJ("/api/me/wishlist/" + propertyId, buyer, Map.of()).andExpect(status().isOk());
        assertEquals(1, body(getJ("/api/me/wishlist", buyer)).size());
    }

    @Test @Order(5)
    void enquiryFlowKeepsBuyerAndSellerApart() throws Exception {
        // unverified email cannot enquire
        String raw = body(postJ("/api/auth/register", null, Map.ofEntries(
                Map.entry("fullName", "Una Unverified"), Map.entry("email", "una@test.com"), Map.entry("phone", "9876500009"),
                Map.entry("address", "1 Rd"), Map.entry("city", "Mohali"), Map.entry("state", "Punjab"),
                Map.entry("postalCode", "160055"), Map.entry("password", "Passw0rdOK"), Map.entry("purpose", "BUY")))).get("token").asText();
        postJ("/api/me/enquiries", raw, Map.of("propertyId", propertyId, "enquiryType", "INFO", "message", "hi")).andExpect(status().isForbidden());

        // sellers cannot enquire about their own property
        postJ("/api/me/enquiries", seller, Map.of("propertyId", propertyId, "enquiryType", "INFO", "message", "hi")).andExpect(status().isBadRequest());

        JsonNode e = body(postJ("/api/me/enquiries", buyer, Map.of("propertyId", propertyId, "enquiryType", "BUY",
                "message", "Is this still available?")).andExpect(status().isOk()));
        enquiryId = e.get("id").asLong();
        postJ("/api/me/enquiries", buyer, Map.of("propertyId", propertyId, "enquiryType", "BUY", "message", "again"))
                .andExpect(status().isConflict());

        // another buyer can't read it; seller can't read it through any buyer API
        getJ("/api/me/enquiries/" + enquiryId, buyer2).andExpect(status().isNotFound());
        getJ("/api/me/enquiries/" + enquiryId, seller).andExpect(status().isNotFound());
        postJ("/api/me/enquiries/" + enquiryId + "/messages", buyer2, Map.of("body", "x")).andExpect(status().isNotFound());
        getJ("/api/agent/enquiries/" + enquiryId, seller).andExpect(status().isForbidden());

        // agent sees the buyer, writes an internal note + a public reply
        JsonNode detail = body(getJ("/api/agent/enquiries/" + enquiryId, agent).andExpect(status().isOk()));
        assertEquals("bella@test.com", detail.get("enquiry").get("buyer").get("email").asText());
        postJ("/api/agent/enquiries/" + enquiryId + "/messages", agent, Map.of("body", "INTERNAL seller wants 90L", "internal", true)).andExpect(status().isOk());
        postJ("/api/agent/enquiries/" + enquiryId + "/messages", agent, Map.of("body", "Hello Bella, happy to help", "internal", false)).andExpect(status().isOk());
        postJ("/api/agent/enquiries/" + enquiryId + "/site-visits", agent,
                Map.of("scheduledAt", java.time.LocalDateTime.now().plusDays(3).withNano(0).toString(), "notes", "Meet at gate")).andExpect(status().isOk());

        String buyerView = getJ("/api/me/enquiries/" + enquiryId, buyer).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertTrue(buyerView.contains("happy to help"));
        assertTrue(buyerView.contains("SITE_VISIT_SCHEDULED"));
        assertFalse(buyerView.contains("INTERNAL"), "internal agent note leaked to buyer");
        for (String secret : new String[]{"sam@test.com", "9876500001", "Sam Seller"}) {
            assertFalse(buyerView.contains(secret), "buyer view leaked " + secret);
        }

        // seller only learns "someone enquired" and sees only the agent channel
        postJ("/api/seller/messages", seller, Map.of("body", "Please keep price firm")).andExpect(status().isOk());
        postJ("/api/agent/customers/" + sellerId + "/messages", agent, Map.of("body", "Noted, thanks")).andExpect(status().isOk());
        String thread = getJ("/api/seller/messages", seller).andReturn().getResponse().getContentAsString();
        assertTrue(thread.contains("Noted, thanks"));
        assertFalse(thread.contains("Bella"));
        String sellerNotes = getJ("/api/account/notifications", seller).andReturn().getResponse().getContentAsString();
        assertFalse(sellerNotes.contains("Bella"), "seller notification named the buyer");
        assertFalse(sellerNotes.contains("bella@test.com"));
        assertEquals(1, body(getJ("/api/seller/dashboard", seller)).get("enquiryCount").asInt());
    }

    @Test @Order(6)
    void dealCompletionMarksPropertySoldAndHidesIt() throws Exception {
        postJ("/api/agent/enquiries/" + enquiryId + "/offers", agent, Map.of("amount", 9000000, "note", "first offer")).andExpect(status().isOk());
        JsonNode sale = body(postJ("/api/agent/sales", agent, Map.ofEntries(
                Map.entry("enquiryId", enquiryId), Map.entry("finalAmount", 8800000), Map.entry("downPayment", 500000),
                Map.entry("dealDate", java.time.LocalDate.now().toString()), Map.entry("totalCommission", 88000),
                Map.entry("advanceReceived", true), Map.entry("balanceReceived", false))).andExpect(status().isOk()));
        long saleId = sale.get("id").asLong();
        // down payment cannot exceed price
        postJ("/api/agent/sales", agent, Map.ofEntries(Map.entry("propertyId", propertyId), Map.entry("buyerId", 3),
                Map.entry("finalAmount", 1000), Map.entry("downPayment", 5000),
                Map.entry("dealDate", java.time.LocalDate.now().toString()))).andExpect(status().is4xxClientError());

        mvc.perform(put("/api/agent/sales/" + saleId).header("Authorization", "Bearer " + agent).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.ofEntries(Map.entry("finalAmount", 8800000), Map.entry("downPayment", 500000),
                        Map.entry("dealDate", java.time.LocalDate.now().toString()), Map.entry("registryDate", java.time.LocalDate.now().toString()),
                        Map.entry("totalCommission", 88000), Map.entry("advanceReceived", true), Map.entry("balanceReceived", true),
                        Map.entry("status", "COMPLETED"))))).andExpect(status().isOk());

        getJ("/api/properties/" + propertyId, null).andExpect(status().isNotFound());
        assertEquals("SOLD", body(getJ("/api/agent/properties/" + propertyId, agent)).get("property").get("status").asText());
        assertEquals("CLOSED", body(getJ("/api/me/enquiries/" + enquiryId, buyer)).get("enquiry").get("status").asText());

        JsonNode stats = body(getJ("/api/agent/dashboard", agent));
        assertEquals(1, stats.get("completedDeals").asInt());
        getJ("/api/agent/export/sales", agent).andExpect(status().isOk());
        byte[] pdf = mvc.perform(get("/api/agent/export/sales.pdf").header("Authorization", "Bearer " + agent))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsByteArray();
        assertEquals("%PDF", new String(pdf, 0, 4), "PDF export is a real PDF");
        getJ("/api/agent/export/sales.pdf", buyer).andExpect(status().isForbidden());
        String sellerFeed = getJ("/api/account/notifications", seller).andReturn().getResponse().getContentAsString();
        assertTrue(sellerFeed.contains("Deal in progress"), "seller told a deal is in progress");
        assertFalse(sellerFeed.contains("Bella"), "deal notice named the buyer");
        assertTrue(body(getJ("/api/agent/audit-logs", agent)).get("page").get("totalElements").asInt() > 5);
    }

    @Test @Order(7)
    void suspendedAccountsCannotSignIn() throws Exception {
        long bobId = body(getJ("/api/account/me", buyer2)).get("id").asLong();
        postJ("/api/agent/customers/" + bobId + "/suspend", agent, Map.of("reason", "test")).andExpect(status().isOk());
        postJ("/api/auth/login", null, Map.of("email", "bob@test.com", "password", "Passw0rdOK", "portal", "CUSTOMER"))
                .andExpect(status().isForbidden());
        getJ("/api/account/me", buyer2).andExpect(status().isUnauthorized());
    }

    private Map<String, Object> propertyPayload() {
        return Map.ofEntries(Map.entry("title", "Test Villa"), Map.entry("propertyType", "Villa"), Map.entry("category", "SALE"),
                Map.entry("description", "Nice"), Map.entry("city", "Chandigarh"), Map.entry("locality", "Sector 21"),
                Map.entry("address", "House 5, Sector 21"), Map.entry("postalCode", "160022"), Map.entry("area", 2400),
                Map.entry("measurementUnit", "sq ft"), Map.entry("price", 9500000), Map.entry("bedrooms", 3),
                Map.entry("bathrooms", 3), Map.entry("parkingAvailable", true), Map.entry("amenities", "Garden,Lift"));
    }
}
