class NovelTracker {
    constructor() {
        this.books = [];
        this.init();
    }

    init() {
        this.loadBooks();
        this.setupEventListeners();
        this.loadDailySummary();
    }

    setupEventListeners() {
        const form = document.getElementById('add-book-form');
        form.addEventListener('submit', (e) => this.handleAddBook(e));
    }

    async handleAddBook(e) {
        e.preventDefault();
        const urlInput = document.getElementById('book-url');
        const url = urlInput.value.trim();

        if (!url) return;

        // Show loading state
        const addButton = document.querySelector('#add-book-form button');
        const originalText = addButton.textContent;
        addButton.textContent = 'Adding book and generating summaries...';
        addButton.disabled = true;

        try {
            const response = await fetch('/api/books', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ url })
            });

            if (response.ok) {
                const book = await response.json();
                this.books.push(book);
                this.renderBooks();
                urlInput.value = '';
                
                // Show success message with summary info
                let message = 'Book added successfully!';
                if (book.initialSummaries && book.initialSummaries.length > 0) {
                    message += ` Generated ${book.initialSummaries.length} chapter summaries.`;
                }
                if (book.summaryError) {
                    message += ` Note: ${book.summaryError}`;
                }
                
                this.showNotification(message, 'success');
                
                // Refresh summaries to show the new ones
                this.loadDailySummary();
                
            } else {
                const error = await response.json();
                this.showNotification(error.message || 'Failed to add book', 'error');
            }
        } catch (error) {
            this.showNotification('Network error. Please try again.', 'error');
        } finally {
            // Restore button state
            addButton.textContent = originalText;
            addButton.disabled = false;
        }
    }

    async loadBooks() {
        try {
            const response = await fetch('/api/books');
            if (response.ok) {
                this.books = await response.json();
                this.renderBooks();
            }
        } catch (error) {
            console.error('Failed to load books:', error);
        }
    }

    renderBooks() {
        const container = document.getElementById('books-container');
        
        if (this.books.length === 0) {
            container.innerHTML = '<p class="empty-state">No books added yet. Add your first book above!</p>';
            return;
        }

        container.innerHTML = this.books.map(book => `
            <div class="book-item">
                <div class="book-title">${this.escapeHtml(book.title)}</div>
                <div class="book-url">${this.escapeHtml(book.url)}</div>
                <div class="book-status">
                    <span class="chapter-count">Chapter ${book.lastChapter || 'N/A'}</span>
                    <span class="last-updated">Updated: ${new Date(book.lastUpdated).toLocaleDateString()}</span>
                    <button class="remove-book" onclick="tracker.removeBook('${book.id}')">Remove</button>
                </div>
            </div>
        `).join('');
    }

    async removeBook(bookId) {
        if (!confirm('Are you sure you want to remove this book?')) return;

        try {
            const response = await fetch(`/api/books/${bookId}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                this.books = this.books.filter(book => book.id !== bookId);
                this.renderBooks();
                this.showNotification('Book removed successfully!', 'success');
            } else {
                this.showNotification('Failed to remove book', 'error');
            }
        } catch (error) {
            this.showNotification('Network error. Please try again.', 'error');
        }
    }

    async loadDailySummary() {
        try {
            const response = await fetch('/api/summary');
            if (response.ok) {
                const summary = await response.json();
                this.renderSummary(summary);
            }
        } catch (error) {
            console.error('Failed to load summary:', error);
        }
    }

    renderSummary(summary) {
        const container = document.getElementById('summary-container');
        
        if (!summary || summary.length === 0) {
            container.innerHTML = '<p class="empty-state">No new chapters today.</p>';
            return;
        }

        container.innerHTML = summary.map(item => `
            <div class="summary-item">
                <div class="summary-title">${this.escapeHtml(item.bookTitle)}</div>
                ${item.imageUrl ? `<div class="summary-image"><img src="${item.imageUrl}" alt="Chapter illustration" loading="lazy"></div>` : ''}
                <div class="summary-content">${this.formatSummaryText(item.summary)}</div>
            </div>
        `).join('');
    }

    formatSummaryText(text) {
        // Split text into paragraphs and format them
        const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
        
        return paragraphs.map(paragraph => {
            const trimmed = paragraph.trim();
            // Check if it's a chapter heading (contains chapter number and title)
            if (trimmed.match(/^Chapter\s+\d+|^第.*章/)) {
                return `<div class="chapter-heading">${this.escapeHtml(trimmed)}</div>`;
            } else {
                return `<p class="summary-paragraph">${this.escapeHtml(trimmed)}</p>`;
            }
        }).join('');
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 5px;
            color: white;
            font-weight: bold;
            z-index: 1000;
            background: ${type === 'success' ? '#27ae60' : '#e74c3c'};
        `;

        document.body.appendChild(notification);

        // Remove after 3 seconds
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize the tracker when the page loads
const tracker = new NovelTracker();