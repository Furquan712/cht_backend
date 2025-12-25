const axios = require('axios');
const cheerio = require('cheerio');
const { URL } = require('url');

// Convert relative URLs to absolute using the page base
function toAbsoluteUrl(base, relative) {
	try {
		return new URL(relative, base).href;
	} catch (e) {
		return relative;
	}
}

// Scrape a page and return structured content
async function scrapePage(url) {
	if (!url) throw new Error('URL is required');
	if (!/^https?:\/\//i.test(url)) url = 'http://' + url;

	try {
		const { data } = await axios.get(url, {
			headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Scraper/1.0)' },
			timeout: 15000,
		});

		const $ = cheerio.load(data);

		const title = ($('title').first().text() || '').trim();
		const metaDescription = ($('meta[name="description"]').attr('content') || $('meta[property="og:description"]').attr('content') || '').trim() || null;

		const headings = [];
		for (let i = 1; i <= 6; i++) {
			$('h' + i).each((_, el) => {
				const text = $(el).text().trim();
				if (text) headings.push({ tag: 'h' + i, text });
			});
		}

		const paragraphs = [];
		$('p').each((_, el) => {
			const text = $(el).text().trim();
			if (text) paragraphs.push(text);
		});

		const spans = [];
		$('span').each((_, el) => {
			const text = $(el).text().trim();
			if (text) spans.push(text);
		});

		const links = [];
		$('a').each((_, el) => {
			const href = $(el).attr('href');
			if (!href) return;
			links.push({
				href: toAbsoluteUrl(url, href),
				text: ($(el).text() || '').trim(),
				title: $(el).attr('title') || null,
				rel: $(el).attr('rel') || null,
			});
		});

		const images = [];
		$('img').each((_, el) => {
			const src = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('data-lazy-src');
			if (!src) return;
			images.push({ src: toAbsoluteUrl(url, src), alt: $(el).attr('alt') || null });
		});

		const bodyText = ($('body').text() || '').replace(/\s+/g, ' ').trim();

		// Build an ordered sequence of important elements as they appear in the DOM
		const sequence = [];
		$('body').find('*').each((_, el) => {
			const tag = (el.tagName || '').toLowerCase();
			if (!tag) return;

			const text = ($(el).text() || '').trim();

			// nearest ancestor heading (h1..h6)
			const closestHeadingEl = $(el).closest('h1,h2,h3,h4,h5,h6');
			let nearestHeading = null;
			if (closestHeadingEl && closestHeadingEl.length) {
				nearestHeading = { tag: (closestHeadingEl[0].tagName || '').toLowerCase(), text: closestHeadingEl.text().trim() };
			}

			// nearest ancestor paragraph
			const closestP = $(el).closest('p');
			let parentParagraph = null;
			if (closestP && closestP.length) {
				parentParagraph = { text: closestP.text().trim() };
			}

			if (/^h[1-6]$/.test(tag)) {
				if (text) sequence.push({ type: tag, text });
			} else if (tag === 'p') {
				if (text) sequence.push({ type: 'p', text, nearestHeading });
			} else if (tag === 'span') {
				if (text) sequence.push({ type: 'span', text, nearestHeading, parentParagraph });
			} else if (tag === 'a') {
				const href = $(el).attr('href') || null;
				sequence.push({ type: 'a', href: href ? toAbsoluteUrl(url, href) : null, text: ($(el).text() || '').trim(), nearestHeading, parentParagraph });
			} else if (tag === 'img') {
				const src = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('data-lazy-src') || null;
				sequence.push({ type: 'img', src: src ? toAbsoluteUrl(url, src) : null, alt: $(el).attr('alt') || null, nearestHeading, parentParagraph });
			}
		});

		return {
			url,
			title,
			metaDescription,
			headings,
			paragraphs,
			spans,
			links,
			images,
			bodyText,
			html: $.html(),
			sequence,
		};
	} catch (err) {
		throw new Error('Scrape failed: ' + (err.message || err));
	}
}

module.exports = { scrapePage };

// Build a JSON object with the requested keys
function buildJson(result) {
	const h = result.headings || [];
	const p = result.paragraphs || [];
	const span = result.spans || [];
	const a = result.links || [];
	const links = Array.from(new Set((a || []).map(l => l.href)));
	const img = result.images || [];
	const sequence = result.sequence || [];

	return { h, p, a, span, links, img, sequence };
}

// Test helper: call scrapePage and print full JSON
async function testScrape(url) {
	try {
		const result = await scrapePage(url);
		const out = buildJson(result);
		console.log(JSON.stringify(out, null, 2));
	} catch (err) {
		console.error('Test scrape failed:', err.message || err);
		process.exitCode = 1;
	}
}

// Main runner — only run when executed directly
async function main() {
	const url = process.argv[2] || 'https://causalfunnel.com';
	await testScrape(url);
}

if (require.main === module) {
	main();
}