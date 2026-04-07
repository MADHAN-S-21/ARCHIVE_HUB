package com.archivehub.controller;

import com.archivehub.model.Collection;
import com.archivehub.model.Role;
import com.archivehub.model.User;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/collections")
public class CollectionController {

    @Autowired
    private com.archivehub.service.CollectionService collectionService;

    @Autowired
    private com.archivehub.service.UserService userService;

    @GetMapping
    public ResponseEntity<List<Collection>> getCollections(@RequestParam(name = "userId") Long userId) {
        // Admin check
        User requester = userService.getUserById(userId);

        // FACULTY can see all collections; ADMIN and USER see only their own
        List<Collection> userCollections = collectionService.getAllCollections().stream()
                .filter(col -> {
                    if (requester != null && requester.getRole() == Role.FACULTY) {
                        return true;
                    }
                    return col.getOwnerId() != null && col.getOwnerId().equals(userId);
                })
                .collect(Collectors.toList());
        return ResponseEntity.ok(userCollections);
    }

    @PostMapping
    public ResponseEntity<?> createCollection(@RequestBody Collection collection) {
        User requester = userService.getUserById(collection.getOwnerId());
        if (requester == null) {
            return ResponseEntity.status(401).body(Map.of("message", "User not found"));
        }
        if (requester.getRole() == Role.FACULTY || requester.getRole() == Role.ADMIN) {
            return ResponseEntity.status(403).body(Map.of("message", "This user is not authorized to create collections"));
        }
        
        // If student, enforce parentId
        if (requester.getRole() == Role.STUDENT) {
            if (collection.getParentId() == null) {
                Optional<Collection> root = collectionService.getAllCollections().stream()
                    .filter(c -> c.getOwnerId().equals(requester.getId()) && c.getParentId() == null)
                    .findFirst();
                
                if (root.isPresent()) {
                    collection.setParentId(root.get().getId());
                }
                // If no root exists, this new collection becomes the root (parentId remains null)
            } else {
                // Verify parentId belongs to them
                Collection parent = collectionService.getCollectionById(collection.getParentId());
                if (parent == null || !parent.getOwnerId().equals(requester.getId())) {
                    return ResponseEntity.status(403).body(Map.of("message", "Invalid parent collection"));
                }
            }
        }

        Collection saved = collectionService.createCollection(collection);
        return ResponseEntity.ok(saved);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteCollection(@PathVariable(name = "id") Long id,
            @RequestParam(name = "userId") Long userId) {
        Collection col = collectionService.getCollectionById(id);
        if (col == null) {
            return ResponseEntity.notFound().build();
        }

        User requester = userService.getUserById(userId);
        if (requester == null || !col.getOwnerId().equals(userId)) {
            return ResponseEntity.status(403).body(Map.of("message", "Unauthorized to delete this collection"));
        }

        try {
            collectionService.deleteCollection(id);
            return ResponseEntity.ok(Map.of("message", "Collection deleted successfully"));
        } catch (IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }
}
