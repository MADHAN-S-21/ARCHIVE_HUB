package com.archivehub.service;

import com.archivehub.model.Collection;
import com.archivehub.repository.CollectionRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
@SuppressWarnings("null")
public class CollectionService {

    @Autowired
    private CollectionRepository collectionRepository;

    @Autowired
    private DocumentService documentService;

    public List<Collection> getAllCollections() {
        return collectionRepository.findAll();
    }

    public Collection getCollectionById(Long id) {
        return collectionRepository.findById(id).orElse(null);
    }

    public Collection createCollection(Collection collection) {
        if (collection.getCreatedAt() == null) {
            collection.setCreatedAt(LocalDateTime.now());
        }
        return collectionRepository.save(collection);
    }

    public boolean deleteCollection(Long id) {
        if (collectionRepository.existsByParentId(id)) {
            throw new IllegalStateException("Delete child collections first");
        }
        if (documentService.hasDocumentsInCollection(id)) {
            throw new IllegalStateException("Delete documents in this collection first");
        }
        if (collectionRepository.existsById(id)) {
            collectionRepository.deleteById(id);
            return true;
        }
        return false;
    }
}
