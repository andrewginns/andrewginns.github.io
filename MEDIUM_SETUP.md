# Medium Integration Setup Guide

This guide will help you set up the Medium integration for your Astro website to automatically pull and display your Medium articles.

## Overview

The Medium integration uses RSS feeds to fetch your articles daily and display them alongside any static content on your Writing page. Articles are automatically synced during the GitHub Actions build process.

## Quick Setup

### 1. Find Your Medium Username

Your Medium username appears in your profile URL:

- **Format**: `https://medium.com/@yourusername`
- **Example**: `https://medium.com/@andrewginns` → username is `andrewginns`

### 2. Test Your RSS Feed

Before configuring, verify your RSS feed works:

1. **Check your RSS URL**: `https://medium.com/feed/@yourusername`
2. **Test in browser**: Visit the URL to see if XML loads
3. **Verify content**: Ensure it shows your recent articles

**Example**: `https://medium.com/feed/@andrewginns`

### 3. Update Configuration

Edit `src/pages/writing.astro` and update the username:

```typescript
const mediumUsername = 'yourusername'; // Replace with your Medium username
```

### 4. Deploy

The integration will automatically fetch articles during the next build:

- **Automatic**: Daily at midnight UTC via GitHub Actions
- **Manual**: Push to main branch or trigger workflow manually

## Detailed Configuration

### Medium Username Options

Medium supports several username formats:

1. **Personal accounts**: `@yourusername`

   - RSS: `https://medium.com/feed/@yourusername`

2. **Publications**: `@publication-name`

   - RSS: `https://medium.com/feed/@publication-name`

3. **Custom domains**: Some publications have custom domains
   - RSS: Usually `https://yourdomain.com/feed`

### Customization Options

#### Article Display Limit

To limit the number of articles shown, modify the Medium data fetching:

```typescript
// In src/lib/medium.ts, after parsing articles:
const articles: MediumArticle[] = items
  .slice(0, 10) // Limit to 10 articles
  .map((item: MediumRSSItem) => {
    // ... rest of mapping
  });
```

#### Tag Filtering

To filter articles by specific tags:

```typescript
// In src/pages/writing.astro, after fetching articles:
const filteredArticles = mediumArticles.filter((article) =>
  article.tags.some((tag) => ['ml', 'ai', 'data-science'].includes(tag.toLowerCase()))
);
```

#### Custom Styling

The integration includes several CSS classes you can customize:

- `.medium-icon` - Medium icon on mobile
- `.medium-badge` - "Medium" badge next to date
- `.post-preview` - Individual article containers

## Troubleshooting

### Common Issues

#### 1. No Articles Appearing

**Symptoms**: Writing page shows "Blog posts coming soon" message

**Solutions**:

1. **Check username**: Verify your Medium username is correct
2. **Test RSS feed**: Visit `https://medium.com/feed/@yourusername` in browser
3. **Check console**: Look for error messages during build
4. **Verify articles exist**: Ensure you have published articles on Medium

#### 2. RSS Feed Not Loading

**Symptoms**: Console shows "Failed to fetch Medium RSS" error

**Solutions**:

1. **Check URL format**: Ensure you're using the correct RSS URL format
2. **Test manually**: Try the RSS URL in a browser or RSS reader
3. **Check privacy settings**: Ensure your Medium profile is public
4. **Network issues**: RSS fetching may timeout - check network connectivity

#### 3. Articles Not Updating

**Symptoms**: New Medium articles don't appear on the site

**Solutions**:

1. **Wait for build**: Articles update only when the site rebuilds
2. **Trigger manual build**: Use GitHub Actions workflow dispatch
3. **Check build logs**: Look for errors in GitHub Actions logs
4. **Cache clearing**: Rebuild will fetch fresh data

#### 4. Malformed Article Content

**Symptoms**: Articles display with broken formatting or HTML tags

**Solutions**:

1. **Check description cleaning**: The system automatically strips HTML
2. **Review Medium content**: Ensure articles have proper descriptions
3. **Update parsing logic**: Modify `src/lib/medium.ts` if needed

### Debug Mode

To enable detailed logging during development:

```typescript
// In src/lib/medium.ts, add console.log statements:
console.log('RSS URL:', rssUrl);
console.log('Raw XML:', xmlText.substring(0, 500));
console.log('Parsed data:', feedData);
console.log('Processed articles:', articles);
```

### Manual Testing

Test the integration locally:

```bash
# Build the site locally
npm run build

# Check build output for Medium-related logs
# Look for messages like:
# "✅ Successfully fetched X Medium articles"
# "⚠️ Using fallback: returning empty data"
```

### Error Handling

The integration includes robust error handling:

1. **Network timeouts**: 5-second timeout for RSS requests
2. **Malformed XML**: Graceful parsing error handling
3. **Missing data**: Fallback to empty state without breaking the site
4. **Rate limiting**: Built-in retry logic (not typically needed for RSS)

## Advanced Configuration

### Multiple Medium Accounts

To pull from multiple Medium accounts or publications:

```typescript
// In src/pages/writing.astro:
const accounts = ['username1', 'username2', 'publication'];
const allArticles = [];

for (const account of accounts) {
  const { articles } = await getCachedMediumData(account);
  allArticles.push(...articles);
}

// Sort combined articles by date
const sortedArticles = allArticles.sort(
  (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
);
```

### Custom RSS Processing

To modify how RSS data is processed:

```typescript
// In src/lib/medium.ts, customize the article mapping:
const articles: MediumArticle[] = items.map((item: MediumRSSItem) => {
  // Custom description extraction
  const description = extractCustomDescription(item);

  // Custom tag processing
  const tags = processCustomTags(item.category);

  // Custom date formatting
  const publishedAt = formatCustomDate(item.pubDate);

  return {
    title: item.title || 'Untitled',
    description,
    url: item.link || '',
    publishedAt,
    tags,
    guid: item.guid || item.link || '',
  };
});
```

### Content Filtering

To filter content based on custom criteria:

```typescript
// Filter out draft or private articles
const publicArticles = articles.filter(
  (article) => !article.title.toLowerCase().includes('[draft]') && !article.tags.includes('private')
);

// Filter by content length
const substantialArticles = articles.filter((article) => article.description.length > 100);
```

## Support

If you encounter issues not covered in this guide:

1. **Check GitHub Actions logs** for detailed error messages
2. **Verify RSS feed** manually in a browser or RSS reader
3. **Test with a different Medium account** to isolate account-specific issues
4. **Review console output** during local builds for debugging information

## Security Notes

- RSS feeds are public and don't require authentication
- No API keys or tokens are needed for basic RSS integration
- The integration only reads public data from your Medium profile
- All fetching happens at build time, not at runtime

## Performance Considerations

- Articles are fetched once per build, then cached
- No runtime API calls impact page load speed
- Failed RSS requests fallback gracefully without breaking the site
- Large numbers of articles may increase build time slightly

---

**Note**: This integration follows the same high-quality patterns used throughout the site, including comprehensive error handling, TypeScript safety, and production-grade caching strategies.
