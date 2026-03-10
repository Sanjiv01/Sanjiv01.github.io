// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyDr4x4S-Ov7V9CTtegLMR57vKheDSRjGLc",
  authDomain: "portfolio-track-12746.firebaseapp.com",
  databaseURL: "https://portfolio-track-12746-default-rtdb.firebaseio.com",  
  projectId: "portfolio-track-12746",
  storageBucket: "portfolio-track-12746.firebasestorage.app",
  messagingSenderId: "554924281864",
  appId: "1:554924281864:web:d75e6c2ef1533da137c1bd",
  measurementId: "G-V2J8W0VKFB"
};

// Initialize Firebase
let db;
let dbRef;

function initFirebase() {
    if (typeof firebase !== 'undefined' && !firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
        db = firebase.database();
        dbRef = db.ref('blog-likes');
    }
}

// Configuration
const PROJECTS_DIR = 'content/projects/';
const BLOG_DIR = 'content/blog/';

// Store current blog post / project for likes
let currentBlogPost = null;
let currentProject = null;

// In-memory caches
const projectCache = {};
const blogCache = {};
const likeCountCache = {};
const likedStateCache = {};

// Project data structure
const projects = [
    {
        file: 'FoodGrid.md',
        slug: 'FoodGrid'
    }
];

// Blog posts data structure
const blogPosts = [
    {
        file: 'llm-orchestration.md',
        slug: 'llm-orchestration'
    }
];

// ---------- Utilities ----------

function escapeHtml(str = '') {
    return str.replace(/[&<>"']/g, m => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[m]));
}

function makeExcerpt(content, maxLength = 180) {
    const plain = content
        .replace(/```[\s\S]*?```/g, '')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/[#>*_\-\[\]\(\)]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

    return plain.length > maxLength ? plain.slice(0, maxLength).trim() + '...' : plain;
}

function observeFadeIn(el) {
    if (el) observer.observe(el);
}

function getProjectMeta(slug) {
    return projects.find(p => p.slug === slug);
}

function getBlogMeta(slug) {
    return blogPosts.find(p => p.slug === slug);
}

// Parse frontmatter from markdown
function parseFrontmatter(markdown) {
    const frontmatterRegex = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/;
    const match = markdown.match(frontmatterRegex);

    if (!match) {
        return { frontmatter: {}, content: markdown };
    }

    const frontmatterText = match[1];
    const content = match[2];
    const frontmatter = {};

    frontmatterText.split('\n').forEach(line => {
        const [key, ...valueParts] = line.split(':');
        if (!key || valueParts.length === 0) return;

        const value = valueParts.join(':').trim();

        if (value.startsWith('[') && value.endsWith(']')) {
            frontmatter[key.trim()] = value
                .slice(1, -1)
                .split(',')
                .map(v => v.trim().replace(/['"]/g, ''))
                .filter(Boolean);
        } else {
            frontmatter[key.trim()] = value.replace(/['"]/g, '');
        }
    });

    return { frontmatter, content };
}

// ---------- Local liked state ----------

function getUserId() {
    let userId = localStorage.getItem('userId');
    if (!userId) {
        userId = 'user_' + Math.random().toString(36).slice(2) + Date.now();
        localStorage.setItem('userId', userId);
    }
    return userId;
}

async function getIsLiked(slug) {
    if (slug in likedStateCache) return likedStateCache[slug];

    try {
        getUserId(); // keeps your existing pattern
        const likedState = localStorage.getItem(`liked-${slug}`) === 'true';
        likedStateCache[slug] = likedState;
        return likedState;
    } catch (error) {
        return false;
    }
}

function setIsLiked(slug, value) {
    likedStateCache[slug] = value;
    try {
        localStorage.setItem(`liked-${slug}`, value ? 'true' : 'false');
    } catch (error) {
        console.error('Error storing liked state:', error);
    }
}

// ---------- Firebase likes ----------

async function getLikeCount(slug) {
    if (slug in likeCountCache) return likeCountCache[slug];
    if (!dbRef) return 0;

    try {
        const timeout = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Firebase timeout')), 1500)
        );

        const fetchCount = async () => {
            const snapshot = await dbRef.child(slug).child('count').once('value');
            const count = snapshot.val();
            return count !== null ? parseInt(count, 10) : 0;
        };

        const count = await Promise.race([fetchCount(), timeout]);
        likeCountCache[slug] = count;
        return count;
    } catch (error) {
        console.error(`Error getting like count for ${slug}:`, error);
        likeCountCache[slug] = 0;
        return 0;
    }
}

async function incrementLikeCount(slug) {
    if (!dbRef) return likeCountCache[slug] || 0;

    try {
        const countRef = dbRef.child(slug).child('count');
        const result = await countRef.transaction(current => (current || 0) + 1);
        const newCount = result.snapshot.val() || 0;
        likeCountCache[slug] = newCount;
        return newCount;
    } catch (error) {
        console.error('Error incrementing like:', error);
        return likeCountCache[slug] || 0;
    }
}

async function decrementLikeCount(slug) {
    if (!dbRef) return likeCountCache[slug] || 0;

    try {
        const countRef = dbRef.child(slug).child('count');
        const result = await countRef.transaction(current => Math.max(0, (current || 0) - 1));
        const newCount = result.snapshot.val() || 0;
        likeCountCache[slug] = newCount;
        return newCount;
    } catch (error) {
        console.error('Error decrementing like:', error);
        return likeCountCache[slug] || 0;
    }
}

function updateLikeUI(slug, count, liked) {
    likeCountCache[slug] = count;
    likedStateCache[slug] = liked;

    document.querySelectorAll(`[data-like-slug="${slug}"]`).forEach(button => {
        const countEl = button.querySelector('.like-count');
        if (countEl) countEl.textContent = count;
        button.classList.toggle('liked', liked);
    });

    if (currentBlogPost === slug) {
        const countEl = document.getElementById('post-like-count');
        const btn = document.getElementById('post-like-button');
        if (countEl) countEl.textContent = count;
        if (btn) btn.classList.toggle('liked', liked);
    }

    if (currentProject === slug) {
        const countEl = document.getElementById('project-like-count');
        const btn = document.getElementById('project-like-button');
        if (countEl) countEl.textContent = count;
        if (btn) btn.classList.toggle('liked', liked);
    }
}

async function hydrateLikeUI(slug) {
    const [count, liked] = await Promise.all([
        getLikeCount(slug),
        getIsLiked(slug)
    ]);

    updateLikeUI(slug, count, liked);
}

async function toggleLikeForSlug(slug) {
    const isLiked = await getIsLiked(slug);

    let newCount;
    let newLikedState;

    if (isLiked) {
        newCount = await decrementLikeCount(slug);
        newLikedState = false;
    } else {
        newCount = await incrementLikeCount(slug);
        newLikedState = true;
    }

    setIsLiked(slug, newLikedState);
    updateLikeUI(slug, newCount, newLikedState);
}

// ---------- Content fetching / caching ----------

async function fetchAndCacheProject(project) {
    if (projectCache[project.slug]) return projectCache[project.slug];

    const response = await fetch(PROJECTS_DIR + project.file);
    if (!response.ok) {
        throw new Error(`Failed to load ${project.file}: ${response.status}`);
    }

    const markdown = await response.text();
    const parsed = parseFrontmatter(markdown);
    projectCache[project.slug] = parsed;
    return parsed;
}

async function fetchAndCacheBlog(post) {
    if (blogCache[post.slug]) return blogCache[post.slug];

    const response = await fetch(BLOG_DIR + post.file);
    if (!response.ok) {
        throw new Error(`Failed to load ${post.file}: ${response.status}`);
    }

    const markdown = await response.text();
    const parsed = parseFrontmatter(markdown);
    blogCache[post.slug] = parsed;
    return parsed;
}

// ---------- Card rendering ----------

function createProjectCard(slug, frontmatter, content) {
    const card = document.createElement('div');
    card.className = 'project-card fade-in';
    card.onclick = () => openProject(slug);

    const tags = Array.isArray(frontmatter.tags) ? frontmatter.tags : [];
    const excerpt = makeExcerpt(content, 200);

    card.innerHTML = `
        <h3 class="project-title">${escapeHtml(frontmatter.title || 'Untitled Project')}</h3>
        <p class="project-description">${escapeHtml(excerpt)}</p>
        <div class="project-tech">
            ${tags.map(tag => `<span class="tech-tag">#${escapeHtml(tag)}</span>`).join('')}
        </div>
        <div class="blog-meta" style="margin-top: 1.5rem;">
            <a href="#" class="read-more" onclick="event.stopPropagation(); openProject('${slug}')">View project →</a>
            <button class="like-button" data-like-slug="${slug}" onclick="event.stopPropagation(); toggleProjectCardLike('${slug}', this)">
                <span class="heart-icon">♥</span>
                <span class="like-count">0</span>
            </button>
        </div>
    `;

    observeFadeIn(card);
    requestAnimationFrame(() => card.classList.add('visible'));
    return card;
}

function createBlogCard(slug, frontmatter, content) {
    const card = document.createElement('div');
    card.className = 'blog-card fade-in';
    card.onclick = () => openBlogPost(slug);

    const tags = Array.isArray(frontmatter.tags) ? frontmatter.tags : [];
    const excerpt = makeExcerpt(content, 150);

    card.innerHTML = `
        ${frontmatter.image ? `<img src="${escapeHtml(frontmatter.image)}" alt="${escapeHtml(frontmatter.title || 'Blog image')}" class="blog-image" loading="lazy">` : ''}
        <div class="blog-content">
            <div class="blog-date">${escapeHtml(frontmatter.date || 'No date')}</div>
            <h3 class="blog-title">${escapeHtml(frontmatter.title || 'Untitled Post')}</h3>
            ${tags.length ? `
                <div class="blog-tags">
                    ${tags.map(tag => `<span class="tech-tag">#${escapeHtml(tag)}</span>`).join('')}
                </div>
            ` : ''}
            <p class="blog-excerpt">${escapeHtml(excerpt)}</p>
            <div class="blog-meta">
                <a href="#" class="read-more" onclick="event.stopPropagation(); openBlogPost('${slug}')">Read more →</a>
                <button class="like-button" data-like-slug="${slug}" onclick="event.stopPropagation(); toggleBlogLike('${slug}', this)">
                    <span class="heart-icon">♥</span>
                    <span class="like-count">0</span>
                </button>
            </div>
        </div>
    `;

    observeFadeIn(card);
    requestAnimationFrame(() => card.classList.add('visible'));
    return card;
}

// ---------- Loaders ----------

async function loadProjects() {
    const container = document.getElementById('projects-container');
    if (!container) return;
    container.innerHTML = '';

    const results = await Promise.allSettled(
        projects.map(async project => {
            const { frontmatter, content } = await fetchAndCacheProject(project);
            return { slug: project.slug, frontmatter, content };
        })
    );

    const likeHydrationTasks = [];

    results.forEach((result, index) => {
        if (result.status !== 'fulfilled') {
            console.error(`Error loading project ${projects[index].file}:`, result.reason);
            return;
        }

        const { slug, frontmatter, content } = result.value;
        const card = createProjectCard(slug, frontmatter, content);
        container.appendChild(card);
        likeHydrationTasks.push(hydrateLikeUI(slug));
    });

    Promise.allSettled(likeHydrationTasks);
}

async function loadBlogPosts() {
    const container = document.getElementById('blog-container');
    if (!container) return;
    container.innerHTML = '';

    const results = await Promise.allSettled(
        blogPosts.map(async post => {
            const { frontmatter, content } = await fetchAndCacheBlog(post);
            return { slug: post.slug, frontmatter, content };
        })
    );

    const likeHydrationTasks = [];

    results.forEach((result, index) => {
        if (result.status !== 'fulfilled') {
            console.error(`Error loading blog post ${blogPosts[index].file}:`, result.reason);
            return;
        }

        const { slug, frontmatter, content } = result.value;
        const card = createBlogCard(slug, frontmatter, content);
        container.appendChild(card);
        likeHydrationTasks.push(hydrateLikeUI(slug));
    });

    Promise.allSettled(likeHydrationTasks);
}

// ---------- Detail views ----------

async function openBlogPost(slug) {
    const post = getBlogMeta(slug);
    if (!post) return;

    try {
        const { frontmatter, content } = await fetchAndCacheBlog(post);
        currentBlogPost = slug;

        document.getElementById('post-title').textContent = frontmatter.title || 'Untitled';
        document.getElementById('post-date').textContent = frontmatter.date || '';

        const tagsContainer = document.getElementById('post-tags');
        const tags = Array.isArray(frontmatter.tags) ? frontmatter.tags : [];
        if (tags.length) {
            tagsContainer.innerHTML = tags.map(tag =>
                `<span class="tech-tag">#${escapeHtml(tag)}</span>`
            ).join('');
            tagsContainer.style.display = 'flex';
        } else {
            tagsContainer.style.display = 'none';
            tagsContainer.innerHTML = '';
        }

        const wordCount = content.trim().split(/\s+/).filter(Boolean).length;
        const readingTime = Math.max(1, Math.ceil(wordCount / 200));
        document.getElementById('post-reading-time').textContent = `${readingTime} min read`;

        const featuredImage = document.getElementById('post-featured-image');
        if (frontmatter.image) {
            featuredImage.src = frontmatter.image;
            featuredImage.style.display = 'block';
            featuredImage.loading = 'lazy';
        } else {
            featuredImage.style.display = 'none';
            featuredImage.removeAttribute('src');
        }

        document.getElementById('post-content').innerHTML = marked.parse(content);

        document.getElementById('post-like-count').textContent = likeCountCache[slug] || 0;
        document.getElementById('post-like-button').classList.toggle('liked', likedStateCache[slug] || false);

        document.getElementById('blog-post-view').classList.add('active');
        document.body.classList.add('viewing-blog-post');
        window.scrollTo(0, 0);

        hydrateLikeUI(slug);
    } catch (error) {
        console.error(`Error opening blog post ${slug}:`, error);
    }
}

function closeBlogPost() {
    document.getElementById('blog-post-view').classList.remove('active');
    document.body.classList.remove('viewing-blog-post');
    currentBlogPost = null;
    window.location.hash = '#blog';
}

async function openProject(slug) {
    const project = getProjectMeta(slug);
    if (!project) return;

    try {
        const { frontmatter, content } = await fetchAndCacheProject(project);
        currentProject = slug;

        document.getElementById('project-title').textContent = frontmatter.title || 'Untitled';

        const tagsContainer = document.getElementById('project-tags');
        const tags = Array.isArray(frontmatter.tags) ? frontmatter.tags : [];
        if (tags.length) {
            tagsContainer.innerHTML = tags.map(tag =>
                `<span class="tech-tag">#${escapeHtml(tag)}</span>`
            ).join('');
            tagsContainer.style.display = 'flex';
        } else {
            tagsContainer.style.display = 'none';
            tagsContainer.innerHTML = '';
        }

        document.getElementById('project-content').innerHTML = marked.parse(content);

        document.getElementById('project-like-count').textContent = likeCountCache[slug] || 0;
        document.getElementById('project-like-button').classList.toggle('liked', likedStateCache[slug] || false);

        document.getElementById('project-post-view').classList.add('active');
        document.body.classList.add('viewing-project');
        window.scrollTo(0, 0);

        hydrateLikeUI(slug);
    } catch (error) {
        console.error(`Error opening project ${slug}:`, error);
    }
}

function closeProject() {
    document.getElementById('project-post-view').classList.remove('active');
    document.body.classList.remove('viewing-project');
    currentProject = null;
    window.location.hash = '#projects';
}

// ---------- Like actions ----------

async function toggleProjectLike() {
    if (!currentProject) return;
    await toggleLikeForSlug(currentProject);
}

async function toggleProjectCardLike(slug, button) {
    if (button) button.disabled = true;
    try {
        await toggleLikeForSlug(slug);
    } finally {
        if (button) button.disabled = false;
    }
}

async function toggleLike() {
    if (!currentBlogPost) return;
    await toggleLikeForSlug(currentBlogPost);
}

async function toggleBlogLike(slug, button) {
    if (button) button.disabled = true;
    try {
        await toggleLikeForSlug(slug);
    } finally {
        if (button) button.disabled = false;
    }
}

// ---------- Theme ----------

function toggleTheme() {
    const html = document.documentElement;
    const current = html.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    updateThemeIcon(next);
}

function updateThemeIcon(theme) {
    const btn = document.getElementById('theme-toggle');
    if (btn) {
        btn.innerHTML = theme === 'dark' ? '&#9788;' : '&#9790;';
    }
}

function initTheme() {
    const saved = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', saved);
    updateThemeIcon(saved);
}

// ---------- Smooth scroll animations ----------

const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
        }
    });
}, observerOptions);

// ---------- Mobile menu ----------

function createMobileMenu() {
    const nav = document.querySelector('nav ul');
    if (!nav) return;

    if (window.innerWidth <= 768) {
        const existingButton = document.querySelector('.mobile-menu-button');

        if (!existingButton) {
            nav.style.display = 'none';

            const menuButton = document.createElement('button');
            menuButton.className = 'mobile-menu-button';
            menuButton.innerHTML = '☰';
            menuButton.style.cssText = 'background: none; border: none; font-size: 1.5rem; cursor: pointer;';

            menuButton.onclick = () => {
                const isHidden = nav.style.display === 'none';
                nav.style.display = isHidden ? 'flex' : 'none';
                nav.style.flexDirection = 'column';
                nav.style.position = 'absolute';
                nav.style.top = '100%';
                nav.style.left = '0';
                nav.style.right = '0';
                nav.style.background = 'var(--bg)';
                nav.style.padding = '1rem';
                nav.style.borderBottom = '1px solid var(--border)';
            };

            document.querySelector('nav .container').appendChild(menuButton);
        }
    } else {
        nav.style.display = 'flex';
        nav.style.flexDirection = 'row';
        nav.style.position = 'static';
        const button = document.querySelector('.mobile-menu-button');
        if (button) button.remove();
    }
}

// ---------- Init ----------

document.addEventListener('DOMContentLoaded', async function() {
    initTheme();
    initFirebase();

    const contactForm = document.getElementById('contact-form');
    if (contactForm) {
        contactForm.addEventListener('submit', function(e) {
            e.preventDefault();

            const formData = new FormData(this);
            const name = formData.get('name');
            const email = formData.get('email');
            const message = formData.get('message');

            const subject = encodeURIComponent(`Portfolio Contact from ${name}`);
            const body = encodeURIComponent(`Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`);
            const mailtoLink = `mailto:sanjivsridhar20@gmail.com?subject=${subject}&body=${body}`;

            window.location.href = mailtoLink;
            this.reset();
        });
    }

    document.querySelectorAll('.fade-in').forEach(el => observeFadeIn(el));

    await Promise.all([
        loadProjects(),
        loadBlogPosts()
    ]);

    window.addEventListener('resize', createMobileMenu);
    createMobileMenu();
});