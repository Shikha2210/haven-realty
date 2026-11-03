package com.example.properity_project.service;

import com.example.properity_project.dto.PropertyDtos.*;
import com.example.properity_project.dto.VerificationDtos.DocView;
import com.example.properity_project.entity.*;
import com.example.properity_project.repository.*;
import com.example.properity_project.util.Errors;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Listing lifecycle: DRAFT -> SUBMITTED -> UNDER_REVIEW -> PUBLISHED (approved) | REJECTED,
 * and PUBLISHED <-> INACTIVE / SUSPENDED, PUBLISHED -> SOLD.
 * Only PUBLISHED listings are ever visible to customers.
 */
@Service
@RequiredArgsConstructor
public class PropertyService {

    public static final String PUBLISHED = "PUBLISHED";
    private static final Set<String> TYPES = Set.of("Residential", "Commercial", "Agricultural", "Apartment",
            "House", "Villa", "Plot", "Office", "Shop", "Land");

    private final PropertyRepository properties;
    private final PropertyImageRepository images;
    private final PropertyDocumentRepository documents;
    private final PropertyApprovalRepository approvals;
    private final WishlistItemRepository wishlist;
    private final RecentlyViewedRepository recent;
    private final EnquiryRepository enquiries;
    private final UserRepository users;
    private final FileStorageService storage;
    private final NotificationService notifications;
    private final AuditService audit;

    public record SearchCriteria(String q, String city, String locality, String type, Integer bhk, String category,
                                 BigDecimal minPrice, BigDecimal maxPrice, BigDecimal minArea, BigDecimal maxArea,
                                 String sort) {}

    // ================================================================ public / customer

    public Page<PropertyCard> search(SearchCriteria c, int page, int size, User viewer) {
        Specification<Property> spec = (root, query, cb) -> {
            List<Predicate> p = new ArrayList<>();
            p.add(cb.equal(root.get("status"), PUBLISHED));
            if (has(c.q())) {
                String like = "%" + c.q().trim().toLowerCase() + "%";
                p.add(cb.or(cb.like(cb.lower(root.get("title")), like), cb.like(cb.lower(root.get("city")), like),
                        cb.like(cb.lower(root.get("locality")), like), cb.like(cb.lower(root.get("address")), like)));
            }
            if (has(c.city())) p.add(cb.equal(cb.lower(root.get("city")), c.city().trim().toLowerCase()));
            if (has(c.locality())) p.add(cb.like(cb.lower(root.get("locality")), "%" + c.locality().trim().toLowerCase() + "%"));
            if (has(c.type())) p.add(cb.equal(cb.lower(root.get("propertyType")), c.type().trim().toLowerCase()));
            if (has(c.category())) p.add(cb.equal(root.get("category"), c.category().toUpperCase()));
            if (c.bhk() != null) {
                p.add(c.bhk() >= 4 ? cb.greaterThanOrEqualTo(root.get("bedrooms"), 4) : cb.equal(root.get("bedrooms"), c.bhk()));
            }
            if (c.minPrice() != null) p.add(cb.greaterThanOrEqualTo(root.get("price"), c.minPrice()));
            if (c.maxPrice() != null) p.add(cb.lessThanOrEqualTo(root.get("price"), c.maxPrice()));
            if (c.minArea() != null) p.add(cb.greaterThanOrEqualTo(root.get("area"), c.minArea()));
            if (c.maxArea() != null) p.add(cb.lessThanOrEqualTo(root.get("area"), c.maxArea()));
            return cb.and(p.toArray(new Predicate[0]));
        };
        Sort sort = switch (c.sort() == null ? "" : c.sort()) {
            case "price_asc" -> Sort.by("price").ascending();
            case "price_desc" -> Sort.by("price").descending();
            case "newest" -> Sort.by("createdAt").descending();
            default -> Sort.by("viewCount").descending().and(Sort.by("createdAt").descending());
        };
        Set<Long> saved = savedIds(viewer);
        return properties.findAll(spec, PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 48), sort))
                .map(p -> card(p, saved));
    }

    @Transactional
    public PropertyDetail detail(Long id, User viewer) {
        Property p = properties.findById(id).orElseThrow(() -> Errors.notFound("Property"));
        boolean owner = viewer != null && p.getSellerId().equals(viewer.getId());
        boolean agent = viewer != null && viewer.isAgent();
        if (!PUBLISHED.equals(p.getStatus()) && !owner && !agent) throw Errors.notFound("Property");
        if (!owner && !agent) {
            p.setViewCount(p.getViewCount() + 1);
            if (viewer != null) {
                RecentlyViewed rv = recent.findByUserIdAndPropertyId(viewer.getId(), id)
                        .orElseGet(() -> RecentlyViewed.builder().userId(viewer.getId()).propertyId(id).build());
                rv.setViewedAt(LocalDateTime.now());
                recent.save(rv);
            }
        }
        List<String> imgs = images.findByPropertyIdOrderBySortOrderAscIdAsc(id).stream().map(i -> imageUrl(id, i.getId())).toList();
        return new PropertyDetail(card(p, savedIds(viewer)), p.getDescription(), p.getPostalCode(), p.isParkingAvailable(),
                amenityList(p.getAmenities()), imgs, p.getConstructionType(), p.getFacing(), p.getApprovedBy(),
                "Our agent handles all enquiries and visits for this property");
    }

    public List<PropertyCard> compare(List<Long> ids) {
        if (ids == null || ids.isEmpty() || ids.size() > 4) throw Errors.bad("Choose between 1 and 4 properties to compare");
        return properties.findAllById(ids).stream().filter(p -> PUBLISHED.equals(p.getStatus()))
                .map(p -> card(p, Set.of())).toList();
    }

    /** Returns the stored image file after checking the viewer may see it. */
    public record ImageFile(Resource resource, String contentType) {}

    public ImageFile imageFile(Long propertyId, Long imageId, User viewer) {
        Property p = properties.findById(propertyId).orElseThrow(() -> Errors.notFound("Image"));
        boolean allowed = PUBLISHED.equals(p.getStatus()) || (viewer != null && (viewer.isAgent() || p.getSellerId().equals(viewer.getId())));
        PropertyImage img = images.findById(imageId).filter(i -> i.getPropertyId().equals(propertyId)).orElse(null);
        if (!allowed || img == null) throw Errors.notFound("Image");
        return new ImageFile(storage.load(img.getStoredName()), img.getContentType());
    }

    public List<PropertyCard> recentlyViewed(User user) {
        return recent.findTop10ByUserIdOrderByViewedAtDesc(user.getId()).stream()
                .map(r -> properties.findById(r.getPropertyId()).orElse(null))
                .filter(p -> p != null && PUBLISHED.equals(p.getStatus()))
                .map(p -> card(p, savedIds(user))).toList();
    }

    public List<PropertyCard> recommended(User user) {
        Set<String> cities = new HashSet<>();
        recent.findTop10ByUserIdOrderByViewedAtDesc(user.getId()).forEach(r ->
                properties.findById(r.getPropertyId()).ifPresent(p -> cities.add(p.getCity().toLowerCase())));
        if (cities.isEmpty() && user.getCity() != null) cities.add(user.getCity().toLowerCase());
        Set<Long> saved = savedIds(user);
        Set<Long> seen = recent.findTop10ByUserIdOrderByViewedAtDesc(user.getId()).stream()
                .map(RecentlyViewed::getPropertyId).collect(Collectors.toSet());
        Specification<Property> spec = (root, q, cb) -> cb.equal(root.get("status"), PUBLISHED);
        return properties.findAll(spec, PageRequest.of(0, 24, Sort.by("createdAt").descending())).stream()
                .filter(p -> !p.getSellerId().equals(user.getId()) && !seen.contains(p.getId()))
                .sorted(Comparator.comparing((Property p) -> !cities.contains(p.getCity().toLowerCase())))
                .limit(6).map(p -> card(p, saved)).toList();
    }

    // ---- wishlist

    @Transactional
    public void addToWishlist(User user, Long propertyId) {
        Property p = properties.findById(propertyId).filter(x -> PUBLISHED.equals(x.getStatus()))
                .orElseThrow(() -> Errors.notFound("Property"));
        if (wishlist.findByUserIdAndPropertyId(user.getId(), p.getId()).isEmpty()) {
            wishlist.save(WishlistItem.builder().userId(user.getId()).propertyId(p.getId()).build());
        }
    }

    @Transactional
    public void removeFromWishlist(User user, Long propertyId) {
        wishlist.findByUserIdAndPropertyId(user.getId(), propertyId).ifPresent(wishlist::delete);
    }

    public List<PropertyCard> wishlist(User user) {
        Set<Long> saved = savedIds(user);
        return wishlist.findByUserIdOrderByIdDesc(user.getId()).stream()
                .map(w -> properties.findById(w.getPropertyId()).orElse(null))
                .filter(p -> p != null && PUBLISHED.equals(p.getStatus())).map(p -> card(p, saved)).toList();
    }

    // ================================================================ seller

    private void requireSeller(User u) {
        if (!u.isSellerEnabled()) throw Errors.forbidden("Your seller verification must be approved before you can list properties");
    }

    private Property owned(User seller, Long id) {
        requireSeller(seller);
        return properties.findById(id).filter(p -> p.getSellerId().equals(seller.getId()))
                .orElseThrow(() -> Errors.notFound("Property"));
    }

    @Transactional
    public SellerProperty create(User seller, PropertyInput in) {
        requireSeller(seller);
        Property p = new Property();
        p.setSellerId(seller.getId());
        apply(p, in);
        p.setStatus("DRAFT");
        properties.save(p);
        audit.log(seller.getId(), "PROPERTY_CREATED", "Property", p.getId(), p.getTitle());
        return sellerView(p);
    }

    @Transactional
    public SellerProperty update(User seller, Long id, PropertyInput in) {
        Property p = owned(seller, id);
        if (Set.of("SUBMITTED", "UNDER_REVIEW", "SOLD", "SUSPENDED").contains(p.getStatus())) {
            throw Errors.conflict("This listing cannot be edited while it is " + p.getStatus().toLowerCase().replace('_', ' '));
        }
        apply(p, in);
        if (p.getStatus().equals(PUBLISHED)) {
            p.setStatus("SUBMITTED"); // edited live listings are re-checked by the agent
            approvals.save(approval(p, "RESUBMITTED", "Edited after publishing", seller.getId()));
            notifications.notifyAgent("Listing edited", p.getTitle() + " needs another review", "/agent/properties");
        }
        audit.log(seller.getId(), "PROPERTY_UPDATED", "Property", id, null);
        return sellerView(p);
    }

    public List<SellerProperty> mine(User seller) {
        requireSeller(seller);
        return properties.findBySellerIdOrderByIdDesc(seller.getId()).stream().map(this::sellerView).toList();
    }

    public SellerProperty mineOne(User seller, Long id) {
        return sellerView(owned(seller, id));
    }

    @Transactional
    public SellerProperty addImages(User seller, Long id, List<MultipartFile> files) {
        Property p = owned(seller, id);
        if (files == null || files.isEmpty()) throw Errors.bad("Choose at least one image");
        int existing = images.findByPropertyIdOrderBySortOrderAscIdAsc(id).size();
        if (existing + files.size() > 12) throw Errors.bad("A listing can have at most 12 images");
        int order = existing;
        for (MultipartFile f : files) {
            var s = storage.store(f, true);
            images.save(PropertyImage.builder().propertyId(id).storedName(s.storedName()).originalName(s.originalName())
                    .contentType(s.contentType()).sortOrder(order++).build());
        }
        return sellerView(p);
    }

    @Transactional
    public SellerProperty removeImage(User seller, Long id, Long imageId) {
        Property p = owned(seller, id);
        images.findById(imageId).filter(i -> i.getPropertyId().equals(id)).ifPresent(images::delete);
        return sellerView(p);
    }

    @Transactional
    public SellerProperty addDocument(User seller, Long id, String docType, MultipartFile file) {
        Property p = owned(seller, id);
        var s = storage.store(file, false);
        documents.save(PropertyDocument.builder().propertyId(id).docType(docType == null || docType.isBlank() ? "OWNERSHIP" : docType.toUpperCase())
                .storedName(s.storedName()).originalName(s.originalName()).contentType(s.contentType()).build());
        audit.log(seller.getId(), "PROPERTY_DOCUMENT_UPLOADED", "Property", id, docType);
        return sellerView(p);
    }

    @Transactional
    public SellerProperty submit(User seller, Long id) {
        Property p = owned(seller, id);
        if (!Set.of("DRAFT", "REJECTED").contains(p.getStatus())) throw Errors.conflict("Only drafts or rejected listings can be submitted");
        if (images.findByPropertyIdOrderBySortOrderAscIdAsc(id).isEmpty()) throw Errors.bad("Add at least one photo before submitting");
        boolean hasOwnership = documents.findByPropertyIdOrderByIdAsc(id).stream().anyMatch(d -> d.getDocType().equals("OWNERSHIP"));
        if (!hasOwnership) throw Errors.bad("Upload an ownership document before submitting");
        boolean resubmit = p.getStatus().equals("REJECTED");
        p.setStatus("SUBMITTED");
        p.setRejectionReason(null);
        p.setUpdatedAt(LocalDateTime.now());
        approvals.save(approval(p, resubmit ? "RESUBMITTED" : "SUBMITTED", null, seller.getId()));
        notifications.notifyAgent("New listing to review", p.getTitle() + " (" + p.getCity() + ")", "/agent/properties");
        audit.log(seller.getId(), "PROPERTY_SUBMITTED", "Property", id, null);
        return sellerView(p);
    }

    @Transactional
    public SellerProperty setActive(User seller, Long id, boolean active) {
        Property p = owned(seller, id);
        if (active && p.getStatus().equals("INACTIVE")) p.setStatus(PUBLISHED);
        else if (!active && p.getStatus().equals(PUBLISHED)) p.setStatus("INACTIVE");
        else throw Errors.conflict("That change is not possible for a " + p.getStatus().toLowerCase() + " listing");
        p.setUpdatedAt(LocalDateTime.now());
        audit.log(seller.getId(), active ? "PROPERTY_REACTIVATED" : "PROPERTY_DEACTIVATED", "Property", id, null);
        return sellerView(p);
    }

    public Map<String, Object> sellerDashboard(User seller) {
        requireSeller(seller);
        Long s = seller.getId();
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("totalProperties", properties.countBySellerId(s));
        m.put("activeListings", properties.countBySellerIdAndStatus(s, PUBLISHED));
        m.put("pendingApprovals", properties.countBySellerIdAndStatus(s, "SUBMITTED") + properties.countBySellerIdAndStatus(s, "UNDER_REVIEW"));
        m.put("rejectedListings", properties.countBySellerIdAndStatus(s, "REJECTED"));
        m.put("soldProperties", properties.countBySellerIdAndStatus(s, "SOLD"));
        m.put("propertyViews", properties.sumViewsBySeller(s));
        m.put("enquiryCount", enquiries.countForSeller(s));
        return m;
    }

    // ================================================================ agent

    public Page<AgentProperty> adminList(List<String> statuses, String q, int page, int size) {
        List<String> wanted = statuses == null || statuses.isEmpty()
                ? List.of("DRAFT", "SUBMITTED", "UNDER_REVIEW", "PUBLISHED", "REJECTED", "SUSPENDED", "INACTIVE", "SOLD") : statuses;
        String like = has(q) ? "%" + q.trim().toLowerCase() + "%" : "%";
        return properties.adminSearch(wanted, like, PageRequest.of(page, size, Sort.by("id").descending())).map(this::agentView);
    }

    public AgentProperty adminOne(Long id) {
        return agentView(properties.findById(id).orElseThrow(() -> Errors.notFound("Property")));
    }

    @Transactional
    public AgentProperty adminUpdate(User agent, Long id, PropertyInput in) {
        Property p = properties.findById(id).orElseThrow(() -> Errors.notFound("Property"));
        apply(p, in);
        audit.log(agent.getId(), "PROPERTY_EDITED_BY_AGENT", "Property", id, null);
        return agentView(p);
    }

    @Transactional
    public AgentProperty startReview(User agent, Long id) {
        Property p = properties.findById(id).orElseThrow(() -> Errors.notFound("Property"));
        if (!p.getStatus().equals("SUBMITTED")) throw Errors.conflict("Only submitted listings can be put under review");
        p.setStatus("UNDER_REVIEW");
        approvals.save(approval(p, "REVIEW_STARTED", null, agent.getId()));
        return agentView(p);
    }

    @Transactional
    public AgentProperty decide(User agent, Long id, PropertyDecision d) {
        Property p = properties.findById(id).orElseThrow(() -> Errors.notFound("Property"));
        String action = d.action().toUpperCase();
        String title = p.getTitle();
        switch (action) {
            case "APPROVE" -> {
                if (!Set.of("SUBMITTED", "UNDER_REVIEW").contains(p.getStatus())) throw Errors.conflict("This listing is not awaiting approval");
                p.setStatus(PUBLISHED);
                p.setRejectionReason(null);
                notifications.notify(p.getSellerId(), "Listing approved", title + " is now live.", "/seller/properties", true);
            }
            case "REJECT" -> {
                if (!Set.of("SUBMITTED", "UNDER_REVIEW").contains(p.getStatus())) throw Errors.conflict("This listing is not awaiting approval");
                if (!has(d.reason())) throw Errors.bad("A rejection reason is required");
                p.setStatus("REJECTED");
                p.setRejectionReason(d.reason());
                notifications.notify(p.getSellerId(), "Listing needs changes", title + ": " + d.reason(), "/seller/properties", true);
            }
            case "SUSPEND" -> {
                if (!p.getStatus().equals(PUBLISHED)) throw Errors.conflict("Only published listings can be suspended");
                if (!has(d.reason())) throw Errors.bad("A reason is required");
                p.setStatus("SUSPENDED");
                p.setRejectionReason(d.reason());
                notifications.notify(p.getSellerId(), "Listing suspended", title + ": " + d.reason(), "/seller/properties", true);
            }
            case "RESTORE" -> {
                if (!p.getStatus().equals("SUSPENDED")) throw Errors.conflict("Only suspended listings can be restored");
                p.setStatus(PUBLISHED);
                p.setRejectionReason(null);
                notifications.notify(p.getSellerId(), "Listing restored", title + " is live again.", "/seller/properties", false);
            }
            default -> throw Errors.bad("Action must be APPROVE, REJECT, SUSPEND or RESTORE");
        }
        p.setUpdatedAt(LocalDateTime.now());
        String decision = switch (action) { case "APPROVE" -> "APPROVED"; case "REJECT" -> "REJECTED"; case "SUSPEND" -> "SUSPENDED"; default -> "RESTORED"; };
        approvals.save(approval(p, decision, d.reason(), agent.getId()));
        audit.log(agent.getId(), "PROPERTY_" + decision, "Property", id, d.reason());
        return agentView(p);
    }

    @Transactional
    public AgentProperty setStatus(User agent, Long id, StatusChange c) {
        Property p = properties.findById(id).orElseThrow(() -> Errors.notFound("Property"));
        String s = c.status().toUpperCase();
        if (!Set.of("INACTIVE", "SOLD").contains(s)) throw Errors.bad("Status must be INACTIVE or SOLD");
        markStatus(p, s, agent.getId(), c.reason());
        return agentView(p);
    }

    /** Also used by sale/rental management when a deal completes (the desktop app's "Completed => Sold" rule). */
    @Transactional
    public void markStatus(Property p, String status, Long actorId, String reason) {
        p.setStatus(status);
        p.setUpdatedAt(LocalDateTime.now());
        approvals.save(approval(p, status, reason, actorId));
        audit.log(actorId, "PROPERTY_" + status, "Property", p.getId(), reason);
        if (status.equals("SOLD")) {
            notifications.notify(p.getSellerId(), "Property marked as sold", p.getTitle(), "/seller/properties", true);
        }
    }

    public PropertyDocument documentFor(User requester, Long docId) {
        PropertyDocument d = documents.findById(docId).orElseThrow(() -> Errors.notFound("Document"));
        Property p = properties.findById(d.getPropertyId()).orElseThrow(() -> Errors.notFound("Document"));
        if (!requester.isAgent() && !p.getSellerId().equals(requester.getId())) throw Errors.notFound("Document");
        audit.log(requester.getId(), "DOCUMENT_VIEWED", "PropertyDocument", docId, null);
        return d;
    }

    // ================================================================ mapping helpers

    private void apply(Property p, PropertyInput in) {
        String type = in.propertyType().trim();
        if (TYPES.stream().noneMatch(t -> t.equalsIgnoreCase(type))) throw Errors.bad("Unknown property type");
        p.setTitle(in.title().trim());
        p.setPropertyType(TYPES.stream().filter(t -> t.equalsIgnoreCase(type)).findFirst().get());
        p.setCategory(in.category());
        p.setDescription(in.description());
        p.setCity(in.city().trim());
        p.setLocality(in.locality());
        p.setAddress(in.address().trim());
        p.setPostalCode(in.postalCode() == null || in.postalCode().isBlank() ? null : in.postalCode());
        p.setArea(in.area());
        p.setMeasurementUnit(has(in.measurementUnit()) ? in.measurementUnit() : "sq ft");
        p.setPrice(in.price());
        p.setBedrooms(in.bedrooms());
        p.setBathrooms(in.bathrooms());
        p.setFurnishingStatus(in.furnishingStatus());
        p.setParkingAvailable(in.parkingAvailable());
        p.setAmenities(in.amenities());
        p.setConstructionType(in.constructionType());
        p.setFacing(in.facing());
        p.setApprovedBy(in.approvedBy());
        p.setUpdatedAt(LocalDateTime.now());
    }

    private PropertyApproval approval(Property p, String decision, String reason, Long actor) {
        return PropertyApproval.builder().propertyId(p.getId()).decision(decision).reason(reason).actorId(actor).build();
    }

    private static boolean has(String s) {
        return s != null && !s.isBlank();
    }

    private Set<Long> savedIds(User viewer) {
        if (viewer == null || viewer.isAgent()) return Set.of();
        return wishlist.findByUserIdOrderByIdDesc(viewer.getId()).stream().map(WishlistItem::getPropertyId).collect(Collectors.toSet());
    }

    private static String imageUrl(Long propertyId, Long imageId) {
        return "/api/properties/" + propertyId + "/images/" + imageId;
    }

    private static List<String> amenityList(String s) {
        if (s == null || s.isBlank()) return List.of();
        return Arrays.stream(s.split(",")).map(String::trim).filter(x -> !x.isEmpty()).toList();
    }

    private PropertyCard card(Property p, Set<Long> saved) {
        String cover = images.findFirstByPropertyIdOrderBySortOrderAscIdAsc(p.getId()).map(i -> imageUrl(p.getId(), i.getId())).orElse(null);
        return new PropertyCard(p.getId(), p.getTitle(), p.getPropertyType(), p.getCategory(), p.getCity(), p.getLocality(),
                p.getPrice(), p.getArea(), p.getMeasurementUnit(), p.getBedrooms(), p.getBathrooms(), p.getFurnishingStatus(),
                cover, true, saved.contains(p.getId()), p.getCreatedAt());
    }

    private SellerProperty sellerView(Property p) {
        List<ImageView> imgs = images.findByPropertyIdOrderBySortOrderAscIdAsc(p.getId()).stream()
                .map(i -> new ImageView(i.getId(), imageUrl(p.getId(), i.getId()))).toList();
        List<DocView> docs = documents.findByPropertyIdOrderByIdAsc(p.getId()).stream()
                .map(d -> new DocView(d.getId(), d.getDocType(), d.getOriginalName(), d.getUploadedAt())).toList();
        return new SellerProperty(p.getId(), p.getTitle(), p.getPropertyType(), p.getCategory(), p.getDescription(), p.getCity(),
                p.getLocality(), p.getAddress(), p.getPostalCode(), p.getArea(), p.getMeasurementUnit(), p.getPrice(),
                p.getBedrooms(), p.getBathrooms(), p.getFurnishingStatus(), p.isParkingAvailable(), p.getAmenities(),
                p.getConstructionType(), p.getFacing(), p.getApprovedBy(), p.getStatus(), p.getRejectionReason(),
                p.getViewCount(), enquiries.countByPropertyId(p.getId()), imgs, docs, p.getCreatedAt(), p.getUpdatedAt());
    }

    private AgentProperty agentView(Property p) {
        User s = users.findById(p.getSellerId()).orElseThrow(() -> Errors.notFound("Seller"));
        List<ApprovalView> history = approvals.findByPropertyIdOrderByIdAsc(p.getId()).stream()
                .map(a -> new ApprovalView(a.getDecision(), a.getReason(), a.getCreatedAt())).toList();
        return new AgentProperty(sellerView(p), new SellerSummary(s.getId(), s.getFullName(), s.getEmail(), s.getPhone(), s.getCity()), history);
    }

    /** Light lookup used by other services. */
    public Property require(Long id) {
        return properties.findById(id).orElseThrow(() -> Errors.notFound("Property"));
    }

    public PropertyCard cardFor(Property p) {
        return card(p, Set.of());
    }
}
