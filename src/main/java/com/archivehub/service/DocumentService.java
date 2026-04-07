package com.archivehub.service;

import com.archivehub.model.Document;
import com.archivehub.repository.DocumentRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
@SuppressWarnings("null")
public class DocumentService {

    @Autowired
    private DocumentRepository documentRepository;

    public List<Document> getAllDocuments() {
        return documentRepository.findAll();
    }

    public Document getDocumentById(Long id) {
        return documentRepository.findById(id).orElse(null);
    }

    public Document saveDocument(Document document) {
        if (document.getUploadDate() == null) {
            document.setUploadDate(LocalDateTime.now());
        }
        return documentRepository.save(document);
    }

    public boolean deleteDocument(Long id) {
        if (documentRepository.existsById(id)) {
            documentRepository.deleteById(id);
            return true;
        }
        return false;
    }

    public boolean hasDocumentsInCollection(Long collectionId) {
        return documentRepository.existsByCollectionId(collectionId);
    }
}
