package com.archivehub.controller;

import com.archivehub.model.Role;
import com.archivehub.model.User;
import com.archivehub.model.UserRequest;
import com.archivehub.service.UserRequestService;
import com.archivehub.service.UserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/admin/requests")
public class UserRequestController {

    @Autowired
    private UserRequestService userRequestService;

    @Autowired
    private UserService userService;

    @GetMapping
    public ResponseEntity<?> getAllRequests(@RequestParam(name = "requesterId") Long requesterId) {
        User requester = userService.getUserById(requesterId);
        if (requester == null || requester.getRole() != Role.ADMIN) {
            return ResponseEntity.status(403).body(Map.of("message", "Only admins can view requests"));
        }
        return ResponseEntity.ok(userRequestService.getAllRequests());
    }

    @PostMapping("/{id}/approve")
    public ResponseEntity<?> approveRequest(@PathVariable(name = "id") Long id,
            @RequestParam(name = "requesterId") Long requesterId) {
        User requester = userService.getUserById(requesterId);
        if (requester == null || requester.getRole() != Role.ADMIN) {
            return ResponseEntity.status(403).body(Map.of("message", "Unauthorized"));
        }

        UserRequest request = userRequestService.getRequestById(id);
        if (request == null) {
            return ResponseEntity.status(404).body(Map.of("message", "Request not found"));
        }

        try {
            User newUser = new User();
            newUser.setUsername(request.getUsername());
            newUser.setEmail(request.getEmail());
            newUser.setPassword(request.getPassword());
            newUser.setFullname(request.getFullname());
            newUser.setRole(request.getRole() != null ? request.getRole() : Role.STUDENT);
            newUser.setRollNumber(request.getRollNumber());
            newUser.setDepartment(request.getDepartment());
            newUser.setFacultyId(request.getFacultyId());

            userService.register(newUser);
            userRequestService.removeRequest(id);

            return ResponseEntity.ok(Map.of("message", "Request approved and student created"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @PostMapping("/{id}/reject")
    public ResponseEntity<?> rejectRequest(@PathVariable(name = "id") Long id,
            @RequestParam(name = "requesterId") Long requesterId) {
        User requester = userService.getUserById(requesterId);
        if (requester == null || requester.getRole() != Role.ADMIN) {
            return ResponseEntity.status(403).body(Map.of("message", "Unauthorized"));
        }

        userRequestService.removeRequest(id);
        return ResponseEntity.ok(Map.of("message", "Request rejected"));
    }
}
