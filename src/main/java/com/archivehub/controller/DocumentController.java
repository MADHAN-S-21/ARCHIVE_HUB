package com.archivehub.controller;

import com.archivehub.model.Document;
import com.archivehub.model.Role;
import com.archivehub.model.User;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/documents")
public class DocumentController {

    @Autowired
    private com.archivehub.service.FileService fileService;

    @Autowired
    private com.archivehub.service.UserService userService;

    @Autowired
    private com.archivehub.service.DocumentService documentService;

    @Autowired
    private com.archivehub.service.CollectionService collectionService;

    @GetMapping
    public ResponseEntity<List<Document>> getDocuments(@RequestParam(name = "userId") Long userId,
            @RequestParam(name = "collectionId", required = false) Long collectionId,
            @RequestParam(name = "isPersonal", defaultValue = "false") boolean isPersonal) {

        // Fetch the user to check role
        User requester = userService.getUserById(userId);

        List<Document> userDocs = documentService.getAllDocuments().stream()
                .filter(doc -> {
                    // Filter by collectionId IF provided, or if null, show only those without collection (top-level)
                    if (collectionId != null) {
                        if (doc.getCollectionId() == null || !doc.getCollectionId().equals(collectionId)) return false;
                    } else {
                        if (doc.getCollectionId() != null) return false;
                    }

                    if (isPersonal) {
                        // Personal docs only visible to owner
                        return doc.isPersonal() && doc.getOwnerId() != null && doc.getOwnerId().equals(userId);
                    } else {
                        // Regular archives (not personal)
                        if (doc.isPersonal()) return false;
                        
                        // Faculty see all archives; others see only their own
                        if (requester != null && requester.getRole() == Role.FACULTY) {
                            return true;
                        }
                        return doc.getOwnerId() != null && doc.getOwnerId().equals(userId);
                    }
                })
                .peek(doc -> {
                    User owner = userService.getUserById(doc.getOwnerId());
                    if (owner != null) doc.setOwnerName(owner.getFullname());
                })
                .collect(Collectors.toList());
        return ResponseEntity.ok(userDocs);
    }

    @PostMapping("/upload")
    public ResponseEntity<?> uploadDocument(@RequestParam(name = "file") MultipartFile file,
            @RequestParam(name = "userId") Long userId,
            @RequestParam(name = "collectionId", required = false) Long collectionId,
            @RequestParam(name = "isPersonal", defaultValue = "false") boolean isPersonal) {

        User requester = userService.getUserById(userId);
        if (requester == null) {
            return ResponseEntity.status(403).body(Map.of("message", "Unauthorized to upload to this section"));
        }
        if (requester.getRole() == Role.ADMIN) {
            return ResponseEntity.status(403).body(Map.of("message", "Admins are not allowed to upload documents"));
        }
        if (requester.getRole() == Role.FACULTY && !isPersonal) {
            return ResponseEntity.status(403).body(Map.of("message", "Unauthorized to upload to this section"));
        }

        // Enforce sub-collection for students
        if (requester.getRole() == Role.STUDENT) {
            if (collectionId == null) {
                return ResponseEntity.status(400).body(Map.of("message", "Please select a sub-collection for your upload. Files cannot be uploaded to the root."));
            }
            com.archivehub.model.Collection targetCol = collectionService.getCollectionById(collectionId);
            if (targetCol == null || targetCol.getParentId() == null) {
                return ResponseEntity.status(400).body(Map.of("message", "Files must be uploaded to a sub-collection, not the root."));
            }
            if (!targetCol.getOwnerId().equals(userId)) {
                return ResponseEntity.status(403).body(Map.of("message", "Invalid collection ownership"));
            }
        }

        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "File is empty"));
        }

        try {
            String filename = fileService.save(file);
            Document doc = new Document();
            doc.setName(file.getOriginalFilename());
            doc.setType(file.getContentType());
            doc.setSize(file.getSize());
            doc.setUploadDate(LocalDateTime.now());
            doc.setOwnerId(userId);
            doc.setCollectionId(collectionId);
            doc.setUrl("/uploads/" + filename);
            doc.setPersonal(isPersonal);
            if (requester != null) doc.setOwnerName(requester.getFullname());

            documentService.saveDocument(doc);

            return ResponseEntity.ok(doc);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("message", "Upload failed: " + e.getMessage()));
        }
    }

    @PatchMapping("/{id}")
    public ResponseEntity<?> updateDocument(@PathVariable(name = "id") Long id,
            @RequestBody Map<String, String> updates,
            @RequestParam(name = "userId") Long userId) {
        Document doc = documentService.getDocumentById(id);
        if (doc == null) {
            return ResponseEntity.status(404).body(Map.of("message", "Document not found"));
        }

        User requester = userService.getUserById(userId);
        if (requester == null) {
            return ResponseEntity.status(403).body(Map.of("message", "Unauthorized"));
        }

        boolean canManage = requester.getRole() == Role.ADMIN || doc.getOwnerId() != null && doc.getOwnerId().equals(userId);
        if (doc.isPersonal() && !canManage) {
            return ResponseEntity.status(403).body(Map.of("message", "Unauthorized"));
        }
        if (!doc.isPersonal() && !canManage) {
            return ResponseEntity.status(403).body(Map.of("message", "Unauthorized"));
        }

        if (updates.containsKey("name")) {
            doc.setName(updates.get("name"));
        }

        return ResponseEntity.ok(documentService.saveDocument(doc));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteDocument(@PathVariable(name = "id") Long id,
            @RequestParam(name = "userId") Long userId) {
        Document doc = documentService.getDocumentById(id);
        if (doc == null) {
            return ResponseEntity.status(404).body(Map.of("message", "Document not found"));
        }

        User requester = userService.getUserById(userId);
        if (requester == null) {
            return ResponseEntity.status(403).body(Map.of("message", "Unauthorized"));
        }

        boolean canManage = requester.getRole() == Role.ADMIN || doc.getOwnerId() != null && doc.getOwnerId().equals(userId);
        if (doc.isPersonal() && !canManage) {
            return ResponseEntity.status(403).body(Map.of("message", "Unauthorized"));
        }
        if (!doc.isPersonal() && !canManage) {
            return ResponseEntity.status(403).body(Map.of("message", "Unauthorized"));
        }

        // Delete physical file
        if (doc.getUrl() != null && doc.getUrl().startsWith("/uploads/")) {
            String filename = doc.getUrl().substring("/uploads/".length());
            try {
                fileService.delete(filename);
            } catch (Exception e) {
                // Log the error but continue with document removal
                System.err.println("Failed to delete physical file: " + e.getMessage());
            }
        }

        documentService.deleteDocument(id);
        return ResponseEntity.ok(Map.of("message", "Document deleted successfully"));
    }
}
