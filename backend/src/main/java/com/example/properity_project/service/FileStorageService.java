package com.example.properity_project.service;

import com.example.properity_project.util.Errors;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

/**
 * Stores uploads OUTSIDE any web-served folder under random names. Files are only ever handed back
 * through controllers that have already checked who is asking.
 */
@Service
public class FileStorageService {

    public record Stored(String storedName, String originalName, String contentType, long size) {}

    private static final Map<String, String> TYPES = Map.of("jpg", "image/jpeg", "jpeg", "image/jpeg",
            "png", "image/png", "pdf", "application/pdf");
    private static final long MAX_IMAGE = 5L * 1024 * 1024;
    private static final long MAX_PDF = 10L * 1024 * 1024;

    private final Path root;

    public FileStorageService(@Value("${app.storage.dir}") String dir) throws IOException {
        this.root = Path.of(dir).toAbsolutePath().normalize();
        Files.createDirectories(root);
    }

    public Stored store(MultipartFile file, boolean imageOnly) {
        if (file == null || file.isEmpty()) throw Errors.bad("Please choose a file to upload");
        String original = sanitise(file.getOriginalFilename());
        String ext = original.contains(".") ? original.substring(original.lastIndexOf('.') + 1).toLowerCase(Locale.ROOT) : "";
        String type = TYPES.get(ext);
        if (type == null || (imageOnly && type.equals("application/pdf"))) {
            throw Errors.bad(imageOnly ? "Only JPG or PNG images are allowed" : "Only JPG, PNG or PDF files are allowed");
        }
        long limit = type.equals("application/pdf") ? MAX_PDF : MAX_IMAGE;
        if (file.getSize() > limit) throw Errors.bad("File is too large (limit " + (limit / 1024 / 1024) + " MB)");
        try (InputStream in = file.getInputStream()) {
            byte[] head = in.readNBytes(8);
            if (!matchesMagic(type, head)) throw Errors.bad("File content does not match its type");
        } catch (IOException e) {
            throw Errors.bad("Could not read the uploaded file");
        }
        String stored = UUID.randomUUID() + "." + ext;
        try (InputStream in = file.getInputStream()) {
            Files.copy(in, root.resolve(stored));
        } catch (IOException e) {
            throw new IllegalStateException("Could not save file", e);
        }
        return new Stored(stored, original, type, file.getSize());
    }

    public Resource load(String storedName) {
        Path p = root.resolve(storedName).normalize();
        if (!p.startsWith(root) || !Files.exists(p)) throw Errors.notFound("File");
        return new FileSystemResource(p);
    }

    public boolean exists(String storedName) {
        return Files.exists(root.resolve(storedName).normalize());
    }

    /** Used by the demo seeder to recreate demo files that the database already references. */
    public void writeNamed(String storedName, byte[] data) {
        Path p = root.resolve(storedName).normalize();
        if (!p.startsWith(root)) throw new IllegalArgumentException("bad name");
        try {
            Files.write(p, data);
        } catch (IOException e) {
            throw new IllegalStateException(e);
        }
    }

    /** Used by the demo seeder. */
    public Stored storeBytes(byte[] data, String ext, String type, String originalName) {
        String stored = UUID.randomUUID() + "." + ext;
        try {
            Files.write(root.resolve(stored), data);
        } catch (IOException e) {
            throw new IllegalStateException(e);
        }
        return new Stored(stored, originalName, type, data.length);
    }

    private static boolean matchesMagic(String type, byte[] h) {
        if (h.length < 4) return false;
        return switch (type) {
            case "image/jpeg" -> (h[0] & 0xFF) == 0xFF && (h[1] & 0xFF) == 0xD8;
            case "image/png" -> (h[0] & 0xFF) == 0x89 && h[1] == 'P' && h[2] == 'N' && h[3] == 'G';
            case "application/pdf" -> h[0] == '%' && h[1] == 'P' && h[2] == 'D' && h[3] == 'F';
            default -> false;
        };
    }

    private static String sanitise(String name) {
        if (name == null) return "file";
        String n = name.replace("\\", "/");
        n = n.substring(n.lastIndexOf('/') + 1).replaceAll("[^A-Za-z0-9._ -]", "_");
        return n.isBlank() ? "file" : n;
    }
}
