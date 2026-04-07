package com.archivehub.service;

import com.archivehub.model.UserRequest;
import com.archivehub.repository.UserRequestRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
@SuppressWarnings("null")
public class UserRequestService {

    @Autowired
    private UserRequestRepository userRequestRepository;

    public UserRequest addRequest(UserRequest request) {
        if (request.getRequestedAt() == null) {
            request.setRequestedAt(LocalDateTime.now());
        }
        return userRequestRepository.save(request);
    }

    public List<UserRequest> getAllRequests() {
        return userRequestRepository.findAll();
    }

    public UserRequest getRequestById(Long id) {
        return userRequestRepository.findById(id).orElse(null);
    }

    public void removeRequest(Long id) {
        if (userRequestRepository.existsById(id)) {
            userRequestRepository.deleteById(id);
        }
    }
}
