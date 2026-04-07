package com.archivehub.controller;

import com.archivehub.model.Document;
import com.archivehub.model.Role;
import com.archivehub.model.User;
import com.archivehub.service.DocumentService;
import com.archivehub.service.UserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/dashboard")
public class DashboardController {

    @Autowired
    private DocumentService documentService;

    @Autowired
    private UserService userService;

    @GetMapping("/stats")
    public ResponseEntity<Map<String, Object>> getStats(@RequestParam(name = "userId") Long userId) {
        User requester = userService.getUserById(userId);
        if (requester == null) {
            return ResponseEntity.status(401).build();
        }

        List<Document> allDocs = documentService.getAllDocuments();

        // FACULTY see all docs in stats; ADMIN and USER see only their own
        List<Document> filteredDocs = allDocs.stream()
                .filter(d -> {
                    if (requester.getRole() == Role.FACULTY) {
                        return true;
                    }
                    return d.getOwnerId() != null && d.getOwnerId().equals(userId);
                })
                .toList();

        Map<String, Object> stats = new HashMap<>();

        // 1. Total Archives
        stats.put("totalArchives", filteredDocs.size());

        // 2. Active Users (Only relevant for Admin)
        if (requester.getRole() == Role.ADMIN) {
            stats.put("activeStudents", userService.getAllUsers().size());
        } else {
            stats.put("activeStudents", 1); // For regular user, just shows themselves as the active session
        }

        // 3. Storage Used (in bytes)
        long totalSize = filteredDocs.stream().mapToLong(d -> d.getSize() != null ? d.getSize() : 0).sum();
        stats.put("storageUsed", totalSize);

        // 4. Recent Uploads (Last 24 hours)
        LocalDateTime twentyFourHoursAgo = LocalDateTime.now().minusHours(24);
        long recentUploads = filteredDocs.stream()
                .filter(d -> d.getUploadDate() != null && d.getUploadDate().isAfter(twentyFourHoursAgo))
                .count();
        stats.put("recentUploads", recentUploads);

        // 5. Academic Stats
        stats.put("cgpa", requester.getCgpa());
        stats.put("semesterSgpas", requester.getSemesterSgpas());
        stats.put("attendancePercentage", requester.getAttendancePercentage());

        return ResponseEntity.ok(stats);
    }
}
