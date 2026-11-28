# Web Console 1.6.245 candidate

The LB form retains the label-initialization fix from 1.6.244 and also preserves
existing system labels whose controls do not exist in this form. Its user,
global-scale and scheduling controls keep ownership of their editable labels;
other settings, such as DNS, image-pull and hostname behavior, are retained.

The added ownership regression verifies that empty editable sections still
remove user/global labels without deleting settings the LB form does not own.
Native upgrade, previous secondary configuration, session and API permissions
are unchanged. Publication and deployed nonempty-secondary acceptance remain
separate requirements; source tests do not establish that lifecycle.
