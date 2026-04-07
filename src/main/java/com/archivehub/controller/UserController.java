package com.archivehub.controller;

import com.archivehub.model.Role;
import com.archivehub.model.User;
import com.archivehub.service.UserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;

@RestController
@RequestMapping("/api/users")
public class UserController {

    public UserController() {
        System.out.println("UserController initialized!");
    }

    @Autowired
    private UserService userService;

    @Autowired
    private com.archivehub.service.FileService fileService;

    @GetMapping
    public ResponseEntity<?> getAllUsers(@RequestParam(name = "requesterId") Long requesterId) {
        User requester = userService.getUserById(requesterId);
        if (requester == null || requester.getRole() != Role.ADMIN) {
            return ResponseEntity.status(403).body(Map.of("message", "Only admins can view all users"));
        }
        return ResponseEntity.ok(userService.getAllUsers());
    }

    @GetMapping("/students")
    public ResponseEntity<?> getAllStudents(@RequestParam(name = "requesterId") Long requesterId) {
        User requester = userService.getUserById(requesterId);
        if (requester == null || requester.getRole() != Role.FACULTY) {
            return ResponseEntity.status(403).body(Map.of("message", "Only faculty can view all students"));
        }
        return ResponseEntity.ok(userService.getAllUsers().stream()
                .filter(u -> u.getRole() == Role.STUDENT)
                .toList());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteUser(@PathVariable(name = "id") Long id,
            @RequestParam(name = "requesterId") Long requesterId) {
        User requester = userService.getUserById(requesterId);
        if (requester == null || (requester.getRole() != Role.ADMIN && !requesterId.equals(id))) {
            return ResponseEntity.status(403).body(Map.of("message", "Unauthorized to delete this student"));
        }
        userService.deleteUser(id);
        return ResponseEntity.ok(Map.of("message", "Student deleted successfully"));
    }

    @PatchMapping("/{id}")
    public ResponseEntity<?> updateUser(@PathVariable(name = "id") Long id, @RequestBody Map<String, Object> updates,
            @RequestParam(name = "requesterId") Long requesterId) {
        User requester = userService.getUserById(requesterId);
        if (requester == null) {
            return ResponseEntity.status(403).body(Map.of("message", "Unauthorized to update this student"));
        }

        boolean isSelfUpdate = requesterId.equals(id);
        boolean isAdmin = requester.getRole() == Role.ADMIN;
        boolean isFaculty = requester.getRole() == Role.FACULTY;

        if (!isAdmin && !isSelfUpdate && !isFaculty) {
            return ResponseEntity.status(403).body(Map.of("message", "Unauthorized to update this student"));
        }

        if (isFaculty && !isSelfUpdate) {
            User targetUser = userService.getUserById(id);
            if (targetUser == null || targetUser.getRole() != Role.STUDENT) {
                return ResponseEntity.status(403).body(Map.of("message", "Faculty can only update student academic records"));
            }

            boolean academicOnly = updates.keySet().stream().allMatch(key ->
                    "cgpa".equals(key) || "semesterSgpas".equals(key) || "attendancePercentage".equals(key));
            if (!academicOnly) {
                return ResponseEntity.status(403).body(Map.of("message", "Faculty can only update student academic records"));
            }
        }

        try {
            User updatedUser = userService.updateUser(id, updates);
            return ResponseEntity.ok(updatedUser);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getUserProfile(@PathVariable(name = "id") Long id,
                                            @RequestParam(name = "requesterId") Long requesterId) {
        User requester = userService.getUserById(requesterId);
        if (requester == null) {
            return ResponseEntity.status(403).body(Map.of("message", "Unauthorized"));
        }
        // Allow the user themselves, admin, or faculty to view the profile
        if (!requesterId.equals(id) && requester.getRole() != Role.ADMIN && requester.getRole() != Role.FACULTY) {
            return ResponseEntity.status(403).body(Map.of("message", "Access denied"));
        }
        User user = userService.getUserById(id);
        if (user == null) {
            return ResponseEntity.status(404).body(Map.of("message", "User not found"));
        }
        return ResponseEntity.ok(user);
    }
    @PostMapping("/{id}/photo")
    public ResponseEntity<?> uploadPhoto(@PathVariable(name = "id") Long id,
                                         @RequestParam("file") MultipartFile file,
                                         @RequestParam(name = "requesterId") Long requesterId) {
        User requester = userService.getUserById(requesterId);
        if (requester == null || (requester.getRole() != Role.ADMIN && !requesterId.equals(id))) {
            return ResponseEntity.status(403).body(Map.of("message", "Unauthorized to change this photo"));
        }
        try {
            String filename = fileService.save(file);
            String photoUrl = "/uploads/" + filename;
            userService.updateUser(id, Map.of("profilePhotoUrl", photoUrl));
            return ResponseEntity.ok(Map.of("url", photoUrl));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("message", "Photo upload failed: " + e.getMessage()));
        }
    }


    @PostMapping
    public ResponseEntity<?> createUser(@RequestBody Map<String, String> userData,
            @RequestParam(name = "requesterId") Long requesterId) {
        User requester = userService.getUserById(requesterId);
        if (requester == null || requester.getRole() != Role.ADMIN) {
            return ResponseEntity.status(403).body(Map.of("message", "Only admins can create students"));
        }
        try {
            User newUser = new User();
            newUser.setFullname(userData.get("fullname"));
            newUser.setUsername(userData.get("username"));
            newUser.setEmail(userData.get("email"));
            newUser.setPassword(userData.get("password") != null ? userData.get("password") : "temp123");
            if (userData.containsKey("role")) {
                newUser.setRole(Role.valueOf(userData.get("role")));
            }
            if (userData.containsKey("rollNumber")) {
                newUser.setRollNumber(userData.get("rollNumber"));
            }
            if (userData.containsKey("department")) {
                newUser.setDepartment(userData.get("department"));
            }
            if (userData.containsKey("facultyId")) {
                newUser.setFacultyId(userData.get("facultyId"));
            }
            User savedUser = userService.register(newUser);
            return ResponseEntity.ok(savedUser);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }
}
