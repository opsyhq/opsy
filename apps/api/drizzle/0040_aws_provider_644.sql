UPDATE "integrations"
SET "provider_version" = '6.44.0'
WHERE "provider" = 'aws'
	AND ("provider_source" IS NULL OR "provider_source" = 'hashicorp/aws')
	AND ("provider_version" IS NULL OR "provider_version" = '5.94.1');
