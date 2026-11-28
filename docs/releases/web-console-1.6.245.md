# Web Console 1.6.245

The LB form retains the label-initialization fix from 1.6.244 and also preserves
existing system labels whose controls do not exist in this form. Its user,
global-scale and scheduling controls keep ownership of their editable labels;
other settings, such as DNS, image-pull and hostname behavior, are retained.

The added ownership regression verifies that empty editable sections still
remove user/global labels without deleting settings the LB form does not own.

## Publication boundary

This immutable component artifact uses the default off build ceiling. It was
rejected by the Server consumer before deployment. Web Console 1.6.246 supplies
the matching Server build ceiling with every page still initially off. Deployed
nonempty-secondary evidence belongs to Server 1.6.609 with 1.6.246.
