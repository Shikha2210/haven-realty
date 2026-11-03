package com.example.properity_project.service;

import com.example.properity_project.dto.AuthDtos.UserView;
import com.example.properity_project.entity.*;
import com.example.properity_project.repository.*;
import com.example.properity_project.util.Errors;
import lombok.RequiredArgsConstructor;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.LocalDateTime;
import java.util.*;

/** Agent-only: customer administration, dashboard analytics, audit trail and spreadsheet exports. */
@Service
@RequiredArgsConstructor
public class AgentService {

    public record AgentCustomer(UserView user, String sellerApplicationStatus, long propertyCount, long enquiryCount,
                                boolean accountEnabled, LocalDateTime joinedAt) {}

    public record AuditView(Long id, Long actorId, String actorName, String action, String entityType, Long entityId,
                            String details, LocalDateTime at) {}

    private final UserRepository users;
    private final UserService userService;
    private final PropertyRepository properties;
    private final EnquiryRepository enquiries;
    private final SellerVerificationRepository verifications;
    private final SaleTransactionRepository sales;
    private final RentalAgreementRepository rentals;
    private final AuditLogRepository auditLogs;
    private final NotificationService notifications;
    private final AuditService audit;

    public Page<AgentCustomer> customers(String q, String kind, int page, int size) {
        String like = q == null || q.isBlank() ? "%" : "%" + q.trim().toLowerCase() + "%";
        PageRequest pr = PageRequest.of(page, size, Sort.by("id").descending());
        var found = "seller".equalsIgnoreCase(kind) ? users.searchSellers(like, pr) : users.searchCustomers(like, pr);
        return found.map(this::customerView);
    }

    public AgentCustomer customer(Long id) {
        return customerView(users.findById(id).filter(u -> !u.isAgent()).orElseThrow(() -> Errors.notFound("Customer")));
    }

    @Transactional
    public AgentCustomer setEnabled(User agent, Long id, boolean enabled, String reason) {
        User u = users.findById(id).filter(x -> !x.isAgent()).orElseThrow(() -> Errors.notFound("Customer"));
        if (!enabled && (reason == null || reason.isBlank())) throw Errors.bad("A reason is required to suspend an account");
        u.setAccountEnabled(enabled);
        audit.log(agent.getId(), enabled ? "ACCOUNT_REACTIVATED" : "ACCOUNT_SUSPENDED", "User", id, reason);
        return customerView(u);
    }

    private AgentCustomer customerView(User u) {
        return new AgentCustomer(userService.toView(u), userService.sellerStatus(u), properties.countBySellerId(u.getId()),
                enquiries.countByCustomerId(u.getId()), u.isAccountEnabled(), u.getCreatedAt());
    }

    public Map<String, Object> dashboard() {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("totalCustomers", users.countByRole("CUSTOMER"));
        m.put("totalBuyers", users.countByRole("CUSTOMER"));
        m.put("totalSellers", users.countByRoleAndSellerEnabledTrue("CUSTOMER"));
        m.put("pendingSellerVerifications", verifications.countByStatus("PENDING") + verifications.countByStatus("UNDER_REVIEW"));
        m.put("verifiedSellers", users.countByRoleAndSellerEnabledTrue("CUSTOMER"));
        m.put("totalProperties", properties.count());
        m.put("pendingPropertyApprovals", properties.countByStatus("SUBMITTED") + properties.countByStatus("UNDER_REVIEW"));
        m.put("activeProperties", properties.countByStatus("PUBLISHED"));
        m.put("totalEnquiries", enquiries.count());
        m.put("pendingEnquiries", enquiries.countByStatus("NEW"));
        m.put("ongoingDeals", sales.countByStatus("ONGOING"));
        m.put("completedDeals", sales.countByStatus("COMPLETED"));
        m.put("activeRentals", rentals.countByStatus("ACTIVE"));

        List<Map<String, Object>> enquiryStatus = new ArrayList<>();
        for (String s : EnquiryService.STATUSES) {
            long n = enquiries.countByStatus(s);
            if (n > 0) enquiryStatus.add(Map.of("name", s, "value", n));
        }
        m.put("enquiriesByStatus", enquiryStatus);
        m.put("propertiesByStatus", pairs(properties.countByStatusGrouped()));
        m.put("propertiesByType", pairs(properties.countByType()));
        m.put("dealsByStatus", pairs(sales.countByStatusGrouped()));
        return m;
    }

    private static List<Map<String, Object>> pairs(List<Object[]> rows) {
        return rows.stream().map(r -> Map.<String, Object>of("name", String.valueOf(r[0]), "value", ((Number) r[1]).longValue())).toList();
    }

    public Page<AuditView> auditTrail(int page, int size) {
        return auditLogs.findAllByOrderByIdDesc(PageRequest.of(page, Math.min(size, 100))).map(a -> {
            String actor = a.getActorId() == null ? "System" : users.findById(a.getActorId()).map(User::getFullName).orElse("Unknown");
            return new AuditView(a.getId(), a.getActorId(), actor, a.getAction(), a.getEntityType(), a.getEntityId(), a.getDetails(), a.getCreatedAt());
        });
    }

    // ------------------------------------------------------------------ Excel / PDF export (kept from the desktop app)

    private record Table(String title, List<String> headers, List<List<String>> rows) {}

    private static String str(Object v) {
        return v == null ? "" : v.toString();
    }

    private Table table(String what) {
        List<List<String>> rows = new ArrayList<>();
        switch (what) {
            case "customers" -> {
                for (User u : users.findAll(Sort.by("id"))) {
                    if (u.isAgent()) continue;
                    rows.add(List.of(str(u.getFullName()), str(u.getEmail()), str(u.getPhone()), str(u.getCity()),
                            u.isSellerEnabled() ? "Yes" : "No", u.isAccountEnabled() ? "Yes" : "No", str(u.getCreatedAt()).replace('T', ' ')));
                }
                return new Table("Customers", List.of("Name", "Email", "Mobile", "City", "Seller", "Active", "Joined"), rows);
            }
            case "properties" -> {
                for (Property p : properties.findAll(Sort.by("id"))) {
                    rows.add(List.of(str(p.getId()), str(p.getTitle()), str(p.getPropertyType()), str(p.getCategory()), str(p.getCity()),
                            str(p.getLocality()), str(p.getPrice()), str(p.getArea()), str(p.getStatus())));
                }
                return new Table("Properties", List.of("ID", "Title", "Type", "For", "City", "Locality", "Price", "Area", "Status"), rows);
            }
            case "sales" -> {
                for (SaleTransaction t : sales.findAll(Sort.by("id"))) {
                    rows.add(List.of(str(t.getId()), properties.findById(t.getPropertyId()).map(Property::getTitle).orElse(""),
                            users.findById(t.getBuyerId()).map(User::getFullName).orElse(""),
                            users.findById(t.getSellerId()).map(User::getFullName).orElse(""), str(t.getFinalAmount()),
                            str(t.getDownPayment()), str(t.getDealDate()), str(t.getRegistryDate()), str(t.getTotalCommission()), str(t.getStatus())));
                }
                return new Table("Sales", List.of("ID", "Property", "Buyer", "Seller", "Final amount", "Down payment", "Deal date",
                        "Registry date", "Commission", "Status"), rows);
            }
            default -> throw Errors.notFound("Export");
        }
    }

    public byte[] export(String what) {
        Table t = table(what);
        try (Workbook wb = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Sheet sheet = wb.createSheet(t.title());
            Row h = sheet.createRow(0);
            for (int i = 0; i < t.headers().size(); i++) h.createCell(i).setCellValue(t.headers().get(i));
            int r = 1;
            for (List<String> row : t.rows()) {
                Row x = sheet.createRow(r++);
                for (int i = 0; i < row.size(); i++) x.createCell(i).setCellValue(row.get(i));
            }
            for (int c = 0; c < t.headers().size(); c++) sheet.autoSizeColumn(c);
            wb.write(out);
            return out.toByteArray();
        } catch (IOException e) {
            throw new IllegalStateException(e);
        }
    }

    /** Landscape A4 table, paginated. Uses a standard PDF font, so non-Latin characters print as '?'. */
    public byte[] exportPdf(String what) {
        Table t = table(what);
        PDRectangle page = new PDRectangle(PDRectangle.A4.getHeight(), PDRectangle.A4.getWidth());
        float margin = 30, rowH = 18, colW = (page.getWidth() - 2 * margin) / t.headers().size();
        PDType1Font bold = new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD);
        PDType1Font plain = new PDType1Font(Standard14Fonts.FontName.HELVETICA);
        try (PDDocument doc = new PDDocument(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            PDPageContentStream cs = null;
            float y = 0;
            int next = 0;
            do {
                if (cs == null || y < margin + rowH) {
                    if (cs != null) cs.close();
                    PDPage pg = new PDPage(page);
                    doc.addPage(pg);
                    cs = new PDPageContentStream(doc, pg);
                    y = page.getHeight() - margin;
                    cs.beginText();
                    cs.setFont(bold, 14);
                    cs.newLineAtOffset(margin, y);
                    cs.showText("Haven Realty - " + t.title());
                    cs.endText();
                    y -= 26;
                    drawRow(cs, bold, 8, t.headers(), margin, y, colW);
                    y -= rowH;
                }
                if (next < t.rows().size()) {
                    drawRow(cs, plain, 8, t.rows().get(next), margin, y, colW);
                    y -= rowH;
                }
                next++;
            } while (next < t.rows().size());
            cs.close();
            doc.save(out);
            return out.toByteArray();
        } catch (IOException e) {
            throw new IllegalStateException(e);
        }
    }

    private static void drawRow(PDPageContentStream cs, PDType1Font font, float size, List<String> cells,
                                float x0, float y, float colW) throws IOException {
        int maxChars = Math.max(4, (int) (colW / (size * 0.5f)));
        for (int i = 0; i < cells.size(); i++) {
            String v = cells.get(i).replaceAll("[^\\x20-\\x7E]", "?");
            if (v.length() > maxChars) v = v.substring(0, maxChars - 1) + "~";
            cs.beginText();
            cs.setFont(font, size);
            cs.newLineAtOffset(x0 + i * colW, y);
            cs.showText(v);
            cs.endText();
        }
    }
}
