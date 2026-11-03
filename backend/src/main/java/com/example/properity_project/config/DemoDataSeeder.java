package com.example.properity_project.config;

import com.example.properity_project.entity.*;
import com.example.properity_project.repository.*;
import com.example.properity_project.service.FileStorageService;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import javax.imageio.ImageIO;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Sample data for demos (SEED_DEMO=true). Photos are generated placeholders, not real listings.
 * Demo passwords are all "Demo@12345"; the agent is agent@haven.test / Agent@12345 unless AGENT_EMAIL is set.
 */
@Component
@Order(2)
@ConditionalOnProperty(name = "app.seed-demo", havingValue = "true")
@RequiredArgsConstructor
public class DemoDataSeeder implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(DemoDataSeeder.class);

    private final UserRepository users;
    private final PropertyRepository properties;
    private final PropertyImageRepository images;
    private final PropertyDocumentRepository docs;
    private final EnquiryRepository enquiries;
    private final BuyerAgentMessageRepository messages;
    private final SellerVerificationRepository verifications;
    private final VerificationDocumentRepository verificationDocs;
    private final SiteVisitRepository visits;
    private final WishlistItemRepository wishlist;
    private final PasswordEncoder encoder;
    private final FileStorageService storage;

    @Override
    public void run(String... args) throws Exception {
        if (users.countByRole("CUSTOMER") > 0) {
            repairMissingFiles();
            return;
        }

        if (users.countByRole("AGENT") == 0) {
            users.save(User.builder().fullName("Aarav Kapoor").email("agent@haven.test").password(encoder.encode("Agent@12345"))
                    .phone("9000000000").city("Chandigarh").state("Punjab").role("AGENT").emailVerified(true).phoneVerified(true)
                    .buyerEnabled(false).build());
        }
        User s1 = customer("Meera Sharma", "meera@haven.test", "9811100001", "Chandigarh", true);
        User s2 = customer("Rohan Gill", "rohan@haven.test", "9811100002", "Mohali", true);
        User b1 = customer("Priya Malhotra", "priya@haven.test", "9811100003", "Panchkula", false);
        User b2 = customer("Kabir Singh", "kabir@haven.test", "9811100004", "Chandigarh", false);
        User applicant = customer("Neha Verma", "neha@haven.test", "9811100005", "Zirakpur", false);

        for (User s : new User[]{s1, s2}) {
            SellerVerification v = verifications.save(SellerVerification.builder().userId(s.getId()).status("VERIFIED").consentGiven(true).build());
            verificationDocs.save(doc(v.getId(), "IDENTITY"));
        }
        SellerVerification pending = verifications.save(SellerVerification.builder().userId(applicant.getId()).status("PENDING").consentGiven(true).build());
        verificationDocs.save(doc(pending.getId(), "IDENTITY"));
        verificationDocs.save(doc(pending.getId(), "ADDRESS"));

        Property p1 = property(s1, "The Courtyard House", "Villa", "SALE", "Chandigarh", "Sector 8", 38500000, 3200, 4, 4, "Semi-furnished", true, "Private garden,Lift,Power backup,24x7 security", new Color(0x1f3a5f), "PUBLISHED");
        property(s1, "Sunlit apartment near Rock Garden", "Apartment", "SALE", "Chandigarh", "Sector 16", 14200000, 1680, 3, 2, "Furnished", true, "Gym,Clubhouse,Lift", new Color(0x2d5a7b), "PUBLISHED");
        Property p3 = property(s2, "Garden-view independent floor", "House", "RENT", "Mohali", "Sector 66", 48000, 2100, 3, 3, "Semi-furnished", true, "Garden,Parking,Modular kitchen", new Color(0x3b6e5b), "PUBLISHED");
        property(s2, "Designed for slow mornings", "Apartment", "SALE", "Panchkula", "Sector 20", 9600000, 1250, 2, 2, "Unfurnished", true, "Park facing,Lift", new Color(0x6b5b3b), "PUBLISHED");
        property(s1, "The open-plan residence", "Villa", "RENT", "Chandigarh", "Sector 5", 85000, 2850, 4, 3, "Furnished", true, "Garden,Terrace,Servant quarter", new Color(0x4a3f6b), "PUBLISHED");
        property(s2, "A home with room to grow", "House", "SALE", "Zirakpur", "VIP Road", 7800000, 1900, 3, 2, "Unfurnished", true, "Gated society,Park", new Color(0x7b3f3f), "PUBLISHED");
        property(s2, "Commercial showroom on main road", "Commercial", "SALE", "Mohali", "Phase 7", 21500000, 1500, 0, 2, "Unfurnished", true, "Corner plot,Ample parking", new Color(0x35505e), "PUBLISHED");
        property(s1, "Two-bedroom flat awaiting review", "Apartment", "RENT", "Chandigarh", "Sector 35", 32000, 1100, 2, 2, "Semi-furnished", false, "Lift", new Color(0x555555), "SUBMITTED");

        Enquiry e = enquiries.save(Enquiry.builder().propertyId(p1.getId()).customerId(b1.getId()).enquiryType("BUY")
                .message("Hello, I am interested in this villa. Is the price negotiable?").status("CONTACTED").build());
        messages.save(BuyerAgentMessage.builder().enquiryId(e.getId()).senderRole("CUSTOMER").senderId(b1.getId()).body(e.getMessage()).build());
        messages.save(BuyerAgentMessage.builder().enquiryId(e.getId()).senderRole("SYSTEM").senderId(0L).body("Your enquiry was received. Our agent will contact you shortly.").build());
        messages.save(BuyerAgentMessage.builder().enquiryId(e.getId()).senderRole("AGENT").senderId(1L).body("Thank you Priya, I will call you today with details.").build());
        enquiries.save(Enquiry.builder().propertyId(p3.getId()).customerId(b2.getId()).enquiryType("SITE_VISIT")
                .message("Could we visit this Saturday morning?").status("NEW").build());
        wishlist.save(WishlistItem.builder().userId(b1.getId()).propertyId(p3.getId()).build());
        log.info("Demo data created. Sign in as priya@haven.test / Demo@12345 (buyer), meera@haven.test (seller), agent@haven.test / Agent@12345");
    }

    /**
     * Demo rows live in the database but their files live on disk. On a fresh server (or a new disk) the files are
     * missing, so recreate them with the same stored names.
     */
    private void repairMissingFiles() throws Exception {
        int fixed = 0;
        Color[] palette = {new Color(0x1f3a5f), new Color(0x2d5a7b), new Color(0x3b6e5b), new Color(0x6b5b3b), new Color(0x4a3f6b), new Color(0x7b3f3f)};
        for (PropertyImage im : images.findAll()) {
            if (storage.exists(im.getStoredName())) continue;
            Property p = properties.findById(im.getPropertyId()).orElse(null);
            if (p == null) continue;
            Color c = palette[(int) (p.getId() % palette.length)];
            storage.writeNamed(im.getStoredName(), render(p.getTitle(), p.getLocality() + ", " + p.getCity(), c, im.getSortOrder()));
            fixed++;
        }
        for (PropertyDocument d : docs.findAll()) {
            if (!storage.exists(d.getStoredName())) { storage.writeNamed(d.getStoredName(), "%PDF-1.4 demo ownership".getBytes()); fixed++; }
        }
        for (VerificationDocument d : verificationDocs.findAll()) {
            if (!storage.exists(d.getStoredName())) { storage.writeNamed(d.getStoredName(), "%PDF-1.4 demo document".getBytes()); fixed++; }
        }
        if (fixed > 0) log.info("Recreated {} missing demo files", fixed);
    }

    private User customer(String name, String email, String phone, String city, boolean seller) {
        return users.save(User.builder().fullName(name).email(email).password(encoder.encode("Demo@12345")).phone(phone)
                .address("Demo address").city(city).state("Punjab").postalCode("160001").role("CUSTOMER").emailVerified(true)
                .phoneVerified(true).buyerEnabled(true).sellerEnabled(seller).dateOfBirth(LocalDate.of(1990, 5, 17)).build());
    }

    private VerificationDocument doc(Long verificationId, String type) {
        var s = storage.storeBytes("%PDF-1.4 demo document".getBytes(), "pdf", "application/pdf", type.toLowerCase() + ".pdf");
        return VerificationDocument.builder().verificationId(verificationId).docType(type).storedName(s.storedName())
                .originalName(s.originalName()).contentType(s.contentType()).sizeBytes(s.size()).build();
    }

    private Property property(User seller, String title, String type, String category, String city, String locality, long price,
                              int area, int beds, int baths, String furnishing, boolean parking, String amenities, Color color,
                              String status) throws Exception {
        Property p = properties.save(Property.builder().sellerId(seller.getId()).title(title).propertyType(type).category(category)
                .description("A well-kept " + type.toLowerCase() + " in " + locality + ", " + city + ". Close to schools, markets and public transport. "
                        + "Sample listing for demonstration purposes.")
                .city(city).locality(locality).address("House/Unit 12, " + locality + ", " + city).postalCode("160022")
                .area(BigDecimal.valueOf(area)).measurementUnit("sq ft").price(BigDecimal.valueOf(price)).bedrooms(beds).bathrooms(baths)
                .furnishingStatus(furnishing).parkingAvailable(parking).amenities(amenities).status(status)
                .facing("East").approvedBy("Municipal Corporation").constructionType("Constructed")
                .viewCount((int) (Math.random() * 120)).createdAt(LocalDateTime.now().minusDays((long) (Math.random() * 40))).build());
        for (int i = 0; i < 3; i++) {
            var s = storage.storeBytes(render(title, locality + ", " + city, color, i), "png", "image/png", "photo" + (i + 1) + ".png");
            images.save(PropertyImage.builder().propertyId(p.getId()).storedName(s.storedName()).originalName(s.originalName())
                    .contentType("image/png").sortOrder(i).build());
        }
        var d = storage.storeBytes("%PDF-1.4 demo ownership".getBytes(), "pdf", "application/pdf", "ownership.pdf");
        docs.save(PropertyDocument.builder().propertyId(p.getId()).docType("OWNERSHIP").storedName(d.storedName())
                .originalName(d.originalName()).contentType(d.contentType()).build());
        return p;
    }

    /** A simple generated placeholder photo (architectural silhouette on a gradient). */
    private byte[] render(String title, String place, Color base, int variant) throws Exception {
        int w = 1200, h = 800;
        BufferedImage img = new BufferedImage(w, h, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = img.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        g.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);
        Color top = variant == 1 ? base.brighter() : base;
        g.setPaint(new GradientPaint(0, 0, top.brighter().brighter(), 0, h, base.darker()));
        g.fillRect(0, 0, w, h);
        g.setColor(new Color(255, 255, 255, 40));
        g.fillOval(w - 330, 60, 170, 170);
        g.setColor(new Color(0, 0, 0, 70));
        int x = 120 + variant * 40;
        g.fillRect(x, 380, 620, 320);
        g.fillPolygon(new int[]{x - 30, x + 310, x + 650}, new int[]{380, 250, 380}, 3);
        g.setColor(new Color(255, 226, 150, 190));
        for (int i = 0; i < 3; i++) g.fillRect(x + 70 + i * 190, 450, 90, 110);
        g.setColor(new Color(0, 0, 0, 90));
        g.fillRect(0, 700, w, 100);
        g.setColor(Color.WHITE);
        g.setFont(new Font("SansSerif", Font.BOLD, 40));
        g.drawString(title.length() > 40 ? title.substring(0, 40) : title, 50, 760);
        g.setFont(new Font("SansSerif", Font.PLAIN, 24));
        g.drawString(place + "  -  sample image", 50, 790);
        g.dispose();
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(img, "png", out);
        return out.toByteArray();
    }
}
