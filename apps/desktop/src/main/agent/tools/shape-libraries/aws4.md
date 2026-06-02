# aws4

**Type:** mxgraph shapes
**Prefix:** `mxgraph.aws4`

## Usage

```xml
<mxCell value="label" style="shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.{shape};fillColor=#ED7100;strokeColor=#ffffff;verticalLabelPosition=bottom;verticalAlign=top;align=center;" vertex="1" parent="1">
  <mxGeometry x="0" y="0" width="78" height="78" as="geometry" />
</mxCell>
```

For simple shapes use: `shape=mxgraph.aws4.{shape};fillColor=#232F3D;`

## Common AWS Service Shapes

### Compute & Containers
- `ec2` - EC2 virtual server
- `ec2_instance` - EC2 instance
- `auto_scaling` - Auto Scaling Group
- `elastic_load_balancing` - ELB
- `application_load_balancer` - ALB
- `network_load_balancer` - NLB
- `lambda` - Lambda function
- `ecs` - ECS container service
- `eks` - EKS Kubernetes
- `fargate` - Fargate serverless containers
- `batch` - AWS Batch

### Storage & CDN
- `s3` - S3 object storage
- `s3_bucket` - S3 bucket
- `s3_glacier` - S3 Glacier archive
- `efs` - Elastic File System
- `fsx` - FSx file system
- `storage_gateway` - Storage Gateway
- `cloudfront` - CloudFront CDN
- `elastic_block_store` - EBS volumes

### Database
- `rds` - RDS relational database
- `aurora` - Aurora database
- `dynamodb` - DynamoDB NoSQL
- `elasticache` - ElastiCache
- `elasticache_cluster` - ElastiCache cluster
- `redshift` - Redshift data warehouse
- `neptune` - Neptune graph database
- `documentdb` - DocumentDB (MongoDB compatible)
- `keyspaces` - Keyspaces (Cassandra compatible)
- `timestream` - Timestream time series
- `ql_db` - QLDB ledger database

### Networking
- `vpc` - Virtual Private Cloud
- `subnet` - Subnet
- `internet_gateway` - Internet Gateway
- `nat_gateway` - NAT Gateway
- `direct_connect` - Direct Connect
- `route_53` - Route 53 DNS
- `api_gateway` - API Gateway
- `vpn_gateway` - VPN Gateway
- `private_link` - PrivateLink
- `transit_gateway` - Transit Gateway
- `network_firewall` - Network Firewall
- `waf` - WAF web application firewall
- `shield` - Shield DDoS protection
- `global_accelerator` - Global Accelerator

### Security & Identity
- `iam` - IAM identity management
- `cognito` - Cognito user pools
- `secrets_manager` - Secrets Manager
- `kms` - Key Management Service
- `cloudhsm` - CloudHSM
- `guardduty` - GuardDuty threat detection
- `inspector` - Inspector vulnerability
- `security_hub` - Security Hub
- `macie` - Macie data classification
- `certificate_manager` - ACM certificates
- `directory_service` - Directory Service

### Messaging & Integration
- `sns` - SNS notifications
- `sqs` - SQS queues
- `eventbridge` - EventBridge
- `step_functions` - Step Functions
- `appsync` - AppSync GraphQL
- `data_pipeline` - Data Pipeline
- `simple_email_service` - SES email

### Analytics & Big Data
- `kinesis` - Kinesis streaming
- `kinesis_data_streams` - Kinesis Data Streams
- `kinesis_data_firehose` - Kinesis Firehose
- `glue` - AWS Glue ETL
- `athena` - Athena query service
- `emr` - EMR Hadoop/Spark
- `quicksight` - QuickSight BI
- `opensearch_service` - OpenSearch Service

### Machine Learning & AI
- `sagemaker` - SageMaker ML platform
- `bedrock` - Bedrock foundation models
- `rekognition` - Rekognition image/video
- `comprehend` - Comprehend NLP
- `translate` - Translate service
- `polly` - Polly text-to-speech
- `lex` - Lex chatbot
- `textract` - Textract document text
- `codeguru` - CodeGuru code review
- `codewhisperer` - CodeWhisperer AI coding

### DevOps & Management
- `cloudformation` - CloudFormation IaC
- `codebuild` - CodeBuild CI
- `codedeploy` - CodeDeploy deployment
- `codepipeline` - CodePipeline
- `cloudwatch` - CloudWatch monitoring
- `cloudtrail` - CloudTrail audit
- `config` - AWS Config
- `systems_manager` - Systems Manager
- `x_ray` - X-Ray tracing

### Application Services
- `elastic_beanstalk` - Elastic Beanstalk
- `lightsail` - Lightsail VPS
- `app_runner` - App Runner

**Note:** This is a curated subset of common services. The full library contains 1000+ shapes.
