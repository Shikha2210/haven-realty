package com.example.properity_project.controller;

import com.example.properity_project.dto.PropertyDtos.*;
import com.example.properity_project.entity.User;
import com.example.properity_project.service.PropertyService;
import com.example.properity_project.service.PropertyService.SearchCriteria;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;

/** Public catalogue. Only PUBLISHED listings are returned; no seller details are ever included. */
@RestController
@RequestMapping("/api/properties")
@RequiredArgsConstructor
public class PropertyController {

    private final PropertyService properties;

    @GetMapping
    public Page<PropertyCard> search(@RequestParam(required = false) String q,
                                     @RequestParam(required = false) String city,
                                     @RequestParam(required = false) String locality,
                                     @RequestParam(required = false) String type,
                                     @RequestParam(required = false) Integer bhk,
                                     @RequestParam(required = false) String category,
                                     @RequestParam(required = false) BigDecimal minPrice,
                                     @RequestParam(required = false) BigDecimal maxPrice,
                                     @RequestParam(required = false) BigDecimal minArea,
                                     @RequestParam(required = false) BigDecimal maxArea,
                                     @RequestParam(required = false) String sort,
                                     @RequestParam(defaultValue = "0") int page,
                                     @RequestParam(defaultValue = "12") int size,
                                     @AuthenticationPrincipal User viewer) {
        return properties.search(new SearchCriteria(q, city, locality, type, bhk, category, minPrice, maxPrice,
                minArea, maxArea, sort), page, size, viewer);
    }

    @GetMapping("/compare")
    public List<PropertyCard> compare(@RequestParam List<Long> ids) {
        return properties.compare(ids);
    }

    @GetMapping("/{id}")
    public PropertyDetail detail(@PathVariable Long id, @AuthenticationPrincipal User viewer) {
        return properties.detail(id, viewer);
    }

    @GetMapping("/{id}/images/{imageId}")
    public ResponseEntity<?> image(@PathVariable Long id, @PathVariable Long imageId, @AuthenticationPrincipal User viewer) {
        var f = properties.imageFile(id, imageId, viewer);
        return ResponseEntity.ok().contentType(MediaType.parseMediaType(f.contentType()))
                .cacheControl(CacheControl.noCache().cachePrivate()).header("X-Content-Type-Options", "nosniff")
                .body(f.resource());
    }
}
