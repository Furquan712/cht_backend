import {QdrantClient} from '@qdrant/js-client-rest';

const client = new QdrantClient({
    url: 'https://7fe42aab-7c36-4099-a7aa-bcdc822fed99.us-east4-0.gcp.cloud.qdrant.io:6333',
    apiKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2Nlc3MiOiJtIn0.DJmxjDgSCyreeNoNc3i7RK-XukLTGEF4waUsI4-CuHY',
});

try {
    const result = await client.getCollections();
    console.log('List of collections:', result.collections);
} catch (err) {
    console.error('Could not get collections:', err);
}